import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import {
  JwtAccessPayload,
  JwtRefreshPayload,
} from '../auth/interfaces/jwt-payload.interface';
import { TokenPair } from '../auth/interfaces/token-pair.interface';
import { TokenInvalidException } from '../common/exceptions/domain.exceptions';

export interface IssuedTokens extends TokenPair {
  /** JTI written into sessions.access_jti */
  jti: string;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async issueTokenPair(
    userId: string,
    email: string,
    sessionId: string,
  ): Promise<IssuedTokens> {
    const jti = uuidv4();
    const accessSecret = this.config.getOrThrow<string>('jwt.accessSecret');
    const refreshSecret = this.config.getOrThrow<string>('jwt.refreshSecret');
    const accessExpiresIn = this.config.get<string>('jwt.accessExpiresIn', '15m');
    const refreshExpiresMs = this.config.get<number>('jwt.refreshExpiresInMs', 604800000);

    const accessPayload: JwtAccessPayload = { sub: userId, email, jti };
    const refreshPayload: JwtRefreshPayload = { sub: userId, sessionId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, { secret: accessSecret, expiresIn: accessExpiresIn }),
      this.jwt.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: Math.floor(refreshExpiresMs / 1000),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryToSeconds(accessExpiresIn),
      jti,
    };
  }

  async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    try {
      return await this.jwt.verifyAsync<JwtAccessPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      });
    } catch {
      throw new TokenInvalidException();
    }
  }

  async verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
    try {
      return await this.jwt.verifyAsync<JwtRefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new TokenInvalidException();
    }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async storeRefreshToken(
    sessionId: string,
    rawToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { sessionId, tokenHash: this.hashToken(rawToken), expiresAt },
    });
  }

  /**
   * Rotates the refresh token for a session.
   *
   * If the old token has already been revoked (possible token reuse / replay
   * attack), the entire session is invalidated and an exception is thrown.
   */
  async rotateRefreshToken(
    sessionId: string,
    oldRawToken: string,
    newRawToken: string,
    newExpiresAt: Date,
  ): Promise<void> {
    const oldHash = this.hashToken(oldRawToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: oldHash },
    });

    const isCompromised =
      !existing ||
      existing.sessionId !== sessionId ||
      existing.revokedAt !== null ||
      new Date() > existing.expiresAt;

    if (isCompromised) {
      // Potential token reuse attack — kill the entire session to protect the user
      await this.prisma.$transaction([
        this.prisma.session.update({
          where: { id: sessionId },
          data: { revokedAt: new Date() },
        }),
        this.prisma.refreshToken.updateMany({
          where: { sessionId },
          data: { revokedAt: new Date() },
        }),
      ]);
      throw new TokenInvalidException();
    }

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          sessionId,
          tokenHash: this.hashToken(newRawToken),
          expiresAt: newExpiresAt,
        },
      }),
    ]);
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15m
    const value = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[match[2]] ?? 1);
  }
}
