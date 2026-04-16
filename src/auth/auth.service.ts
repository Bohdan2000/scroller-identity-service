import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { OAuthProvider, User, UserStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { SessionsService } from '../sessions/sessions.service';
import { DevicesService } from '../devices/devices.service';
import { OAuthService } from '../oauth/oauth.service';
import { EventsService } from '../events/events.service';
import { RoutingKeys } from '../events/events.constants';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { OAuthGoogleDto } from './dto/oauth-google.dto';
import { OAuthAppleDto } from './dto/oauth-apple.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAccessPayload } from './interfaces/jwt-payload.interface';
import {
  AccountBlockedException,
  EmailAlreadyExistsException,
  InvalidCredentialsException,
  SessionNotFoundException,
} from '../common/exceptions/domain.exceptions';

interface DeviceContext {
  deviceId?: string;
  platform?: string;
  appVersion?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly sessions: SessionsService,
    private readonly devices: DevicesService,
    private readonly oauth: OAuthService,
    private readonly config: ConfigService,
    private readonly events: EventsService,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  async signUp(dto: SignUpDto, ctx: DeviceContext): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new EmailAlreadyExistsException();

    const rounds = this.config.get<number>('bcrypt.rounds', 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        emailVerified: false,
        status: UserStatus.active,
      },
    });

    void this.events.publish(RoutingKeys.USER_REGISTERED, {
      userId: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    });

    return this.createSessionAndRespond(user, ctx);
  }

  async signIn(dto: SignInDto, ctx: DeviceContext): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Constant-time-ish: always hash even when user not found to prevent timing attacks
    if (!user || !user.passwordHash) {
      await bcrypt.hash('dummy', 1);
      throw new InvalidCredentialsException();
    }

    if (user.status === UserStatus.blocked) throw new AccountBlockedException();

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new InvalidCredentialsException();

    return this.createSessionAndRespond(user, {
      ...ctx,
      deviceId: dto.deviceId ?? ctx.deviceId,
      platform: dto.platform ?? ctx.platform,
      appVersion: dto.appVersion ?? ctx.appVersion,
    });
  }

  async oauthGoogle(dto: OAuthGoogleDto, ctx: DeviceContext): Promise<AuthResponseDto> {
    const info = await this.oauth.verifyGoogleToken(dto.idToken);
    return this.handleOAuthLogin(OAuthProvider.google, info, {
      ...ctx,
      deviceId: dto.deviceId ?? ctx.deviceId,
      platform: dto.platform ?? ctx.platform,
      appVersion: dto.appVersion ?? ctx.appVersion,
    });
  }

  async oauthApple(dto: OAuthAppleDto, ctx: DeviceContext): Promise<AuthResponseDto> {
    const info = await this.oauth.verifyAppleToken(dto.identityToken);
    return this.handleOAuthLogin(OAuthProvider.apple, info, {
      ...ctx,
      deviceId: dto.deviceId ?? ctx.deviceId,
      platform: dto.platform ?? ctx.platform,
      appVersion: dto.appVersion ?? ctx.appVersion,
    });
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const payload = await this.tokens.verifyRefreshToken(dto.refreshToken);

    const session = await this.sessions.findActiveById(payload.sessionId);
    if (!session) throw new SessionNotFoundException();

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === UserStatus.blocked) throw new InvalidCredentialsException();

    const refreshExpiresMs = this.config.get<number>('jwt.refreshExpiresInMs', 604800000);
    const newExpiresAt = new Date(Date.now() + refreshExpiresMs);

    const newTokens = await this.tokens.issueTokenPair(user.id, user.email, session.id);

    // Rotate token and update JTI atomically enough — both ops reference the same session
    await Promise.all([
      this.tokens.rotateRefreshToken(
        session.id,
        dto.refreshToken,
        newTokens.refreshToken,
        newExpiresAt,
      ),
      this.sessions.updateJti(session.id, newTokens.jti),
    ]);

    return this.buildResponse(user, newTokens);
  }

  async logout(
    accessJti: string,
    refreshToken?: string,
  ): Promise<void> {
    const session = await this.sessions.findActiveByJti(accessJti);

    // Idempotent — if session is already gone, silently succeed
    if (!session) return;

    await this.sessions.revoke(session.id);

    if (refreshToken) {
      const tokenHash = this.tokens.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { sessionId: session.id, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    void this.events.publish(RoutingKeys.USER_SESSION_REVOKED, {
      userId: session.userId,
      sessionId: session.id,
    });
  }

  async getMe(payload: JwtAccessPayload): Promise<AuthResponseDto['user']> {
    // /me does a full session liveness check — token alone is not enough
    const session = await this.sessions.findActiveByJti(payload.jti);
    if (!session) throw new SessionNotFoundException();

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === UserStatus.blocked) throw new InvalidCredentialsException();

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async handleOAuthLogin(
    provider: OAuthProvider,
    info: { providerUserId: string; email: string; emailVerified: boolean },
    ctx: DeviceContext,
  ): Promise<AuthResponseDto> {
    // 1. Find user by existing OAuth identity
    let user = await this.prisma.user.findFirst({
      where: { authIdentities: { some: { provider, providerUserId: info.providerUserId } } },
    });

    if (!user) {
      // 2. Try to link to an existing email account
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email: info.email },
      });

      if (existingByEmail) {
        user = existingByEmail;
        await this.prisma.authIdentity.create({
          data: {
            userId: user.id,
            provider,
            providerUserId: info.providerUserId,
            providerEmail: info.email,
          },
        });
      } else {
        // 3. Create a brand-new user
        user = await this.prisma.user.create({
          data: {
            email: info.email,
            emailVerified: info.emailVerified,
            status: UserStatus.active,
            authIdentities: {
              create: {
                provider,
                providerUserId: info.providerUserId,
                providerEmail: info.email,
              },
            },
          },
        });

        void this.events.publish(RoutingKeys.USER_REGISTERED, {
          userId: user.id,
          email: user.email,
          provider,
          createdAt: user.createdAt.toISOString(),
        });
      }
    }

    if (user.status === UserStatus.blocked) throw new AccountBlockedException();

    return this.createSessionAndRespond(user, ctx);
  }

  private async createSessionAndRespond(
    user: User,
    ctx: DeviceContext,
  ): Promise<AuthResponseDto> {
    const deviceId = ctx.deviceId ?? uuidv4();
    const refreshExpiresMs = this.config.get<number>('jwt.refreshExpiresInMs', 604800000);
    const sessionExpiresAt = new Date(Date.now() + refreshExpiresMs);

    // Create session with a temporary JTI — replaced after token issuance
    const session = await this.sessions.create({
      userId: user.id,
      deviceId,
      accessJti: uuidv4(),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      expiresAt: sessionExpiresAt,
    });

    const tokenData = await this.tokens.issueTokenPair(user.id, user.email, session.id);

    await Promise.all([
      // Swap placeholder JTI with the real one from the signed token
      this.sessions.updateJti(session.id, tokenData.jti),
      // Persist hashed refresh token
      this.tokens.storeRefreshToken(session.id, tokenData.refreshToken, sessionExpiresAt),
      // Update device tracking if a device identifier was provided
      ...(ctx.deviceId
        ? [this.devices.upsert({ userId: user.id, deviceId, platform: ctx.platform, appVersion: ctx.appVersion })]
        : []),
    ]);

    return this.buildResponse(user, tokenData);
  }

  private buildResponse(
    user: User,
    tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  ): AuthResponseDto {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

}
