import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { TokensService } from '../tokens/tokens.service';
import { SessionsService } from '../sessions/sessions.service';
import { DevicesService } from '../devices/devices.service';
import { OAuthService } from '../oauth/oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountBlockedException,
  EmailAlreadyExistsException,
  InvalidCredentialsException,
  SessionNotFoundException,
} from '../common/exceptions/domain.exceptions';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  passwordHash: '$2a$12$hashedpassword',
  emailVerified: false,
  status: UserStatus.active,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

const mockSession = {
  id: 'session-uuid-1',
  userId: mockUser.id,
  deviceId: 'device-uuid-1',
  accessJti: 'jti-uuid-1',
  ip: '127.0.0.1',
  userAgent: 'TestAgent/1.0',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  createdAt: new Date(),
};

const mockTokens = {
  accessToken: 'access.token.here',
  refreshToken: 'refresh.token.here',
  expiresIn: 900,
  jti: 'jti-uuid-1',
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    updateMany: jest.fn(),
  },
};

const mockTokensService = {
  issueTokenPair: jest.fn().mockResolvedValue(mockTokens),
  verifyRefreshToken: jest.fn(),
  rotateRefreshToken: jest.fn(),
  storeRefreshToken: jest.fn(),
  hashToken: jest.fn().mockReturnValue('hashed-token'),
};

const mockSessionsService = {
  create: jest.fn().mockResolvedValue(mockSession),
  findActiveByJti: jest.fn(),
  findActiveById: jest.fn(),
  updateJti: jest.fn(),
  revoke: jest.fn(),
};

const mockDevicesService = {
  upsert: jest.fn(),
};

const mockOAuthService = {
  verifyGoogleToken: jest.fn(),
  verifyAppleToken: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: unknown) => {
    const values: Record<string, unknown> = {
      'bcrypt.rounds': 1, // fast for tests
      'jwt.refreshExpiresInMs': 604800000,
    };
    return values[key] ?? fallback;
  }),
  getOrThrow: jest.fn((key: string) => {
    const values: Record<string, unknown> = {
      'jwt.accessSecret': 'test-access-secret',
      'jwt.refreshSecret': 'test-refresh-secret',
    };
    if (!(key in values)) throw new Error(`Missing config: ${key}`);
    return values[key];
  }),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TokensService, useValue: mockTokensService },
        { provide: SessionsService, useValue: mockSessionsService },
        { provide: DevicesService, useValue: mockDevicesService },
        { provide: OAuthService, useValue: mockOAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─── signUp ─────────────────────────────────────────────────────────────────

  describe('signUp', () => {
    const dto = { email: 'new@example.com', password: 'Password1' };
    const ctx = { ip: '127.0.0.1', userAgent: 'TestAgent/1.0' };

    it('creates a user and returns tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...mockUser,
        email: dto.email,
      });

      const result = await service.signUp(dto, ctx);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: dto.email }),
        }),
      );
      expect(result.tokenType).toBe('Bearer');
      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe(dto.email);
    });

    it('throws EmailAlreadyExistsException when email is taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.signUp(dto, ctx)).rejects.toThrow(
        EmailAlreadyExistsException,
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  // ─── signIn ─────────────────────────────────────────────────────────────────

  describe('signIn', () => {
    const ctx = { ip: '127.0.0.1', userAgent: 'TestAgent/1.0' };

    it('returns tokens on valid credentials', async () => {
      // bcrypt compare will run with real hash — use a known pair
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('Password1', 1);
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash });

      const result = await service.signIn(
        { email: mockUser.email, password: 'Password1' },
        ctx,
      );

      expect(result.accessToken).toBeDefined();
    });

    it('throws InvalidCredentialsException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.signIn({ email: 'ghost@x.com', password: 'Password1' }, ctx),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('throws InvalidCredentialsException on wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('CorrectPass1', 1);
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash });

      await expect(
        service.signIn({ email: mockUser.email, password: 'WrongPass1' }, ctx),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('throws AccountBlockedException for blocked users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: UserStatus.blocked,
      });

      await expect(
        service.signIn({ email: mockUser.email, password: 'Password1' }, ctx),
      ).rejects.toThrow(AccountBlockedException);
    });
  });

  // ─── refresh ────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    const dto = { refreshToken: 'old-refresh-token' };

    it('rotates tokens and returns new pair', async () => {
      mockTokensService.verifyRefreshToken.mockResolvedValue({
        sub: mockUser.id,
        sessionId: mockSession.id,
      });
      mockSessionsService.findActiveById.mockResolvedValue(mockSession);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.refresh(dto);

      expect(mockTokensService.rotateRefreshToken).toHaveBeenCalledWith(
        mockSession.id,
        dto.refreshToken,
        mockTokens.refreshToken,
        expect.any(Date),
      );
      expect(mockSessionsService.updateJti).toHaveBeenCalledWith(
        mockSession.id,
        mockTokens.jti,
      );
      expect(result.accessToken).toBeDefined();
    });

    it('throws SessionNotFoundException when session is gone', async () => {
      mockTokensService.verifyRefreshToken.mockResolvedValue({
        sub: mockUser.id,
        sessionId: mockSession.id,
      });
      mockSessionsService.findActiveById.mockResolvedValue(null);

      await expect(service.refresh(dto)).rejects.toThrow(SessionNotFoundException);
    });
  });

  // ─── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the session', async () => {
      mockSessionsService.findActiveByJti.mockResolvedValue(mockSession);

      await service.logout('jti-uuid-1');

      expect(mockSessionsService.revoke).toHaveBeenCalledWith(mockSession.id);
    });

    it('also revokes refresh token when provided', async () => {
      mockSessionsService.findActiveByJti.mockResolvedValue(mockSession);

      await service.logout('jti-uuid-1', 'raw-refresh-token');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('is idempotent when session is already gone', async () => {
      mockSessionsService.findActiveByJti.mockResolvedValue(null);

      await expect(service.logout('jti-uuid-1')).resolves.toBeUndefined();
      expect(mockSessionsService.revoke).not.toHaveBeenCalled();
    });
  });

  // ─── getMe ──────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    const payload = { sub: mockUser.id, email: mockUser.email, jti: 'jti-uuid-1' };

    it('returns user data when session is active', async () => {
      mockSessionsService.findActiveByJti.mockResolvedValue(mockSession);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe(payload);

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('throws SessionNotFoundException when session is revoked', async () => {
      mockSessionsService.findActiveByJti.mockResolvedValue(null);

      await expect(service.getMe(payload)).rejects.toThrow(SessionNotFoundException);
    });
  });
});
