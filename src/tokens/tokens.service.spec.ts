import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokensService } from './tokens.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenInvalidException } from '../common/exceptions/domain.exceptions';

const mockPrisma = {
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  session: {
    update: jest.fn(),
  },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
};

const mockJwt = {
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn((key: string) => {
    const values: Record<string, unknown> = {
      'jwt.accessSecret': 'access-secret',
      'jwt.refreshSecret': 'refresh-secret',
    };
    if (!(key in values)) throw new Error(`Missing config: ${key}`);
    return values[key];
  }),
  get: jest.fn((key: string, fallback?: unknown) => {
    const values: Record<string, unknown> = {
      'jwt.accessExpiresIn': '15m',
      'jwt.refreshExpiresInMs': 604800000,
    };
    return values[key] ?? fallback;
  }),
};

describe('TokensService', () => {
  let service: TokensService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TokensService>(TokensService);
  });

  describe('issueTokenPair', () => {
    it('returns access + refresh tokens with jti', async () => {
      mockJwt.signAsync
        .mockResolvedValueOnce('access.token')
        .mockResolvedValueOnce('refresh.token');

      const result = await service.issueTokenPair('user-1', 'u@x.com', 'session-1');

      expect(result.accessToken).toBe('access.token');
      expect(result.refreshToken).toBe('refresh.token');
      expect(result.jti).toBeDefined();
      expect(result.expiresIn).toBe(900); // 15m in seconds
    });
  });

  describe('hashToken', () => {
    it('produces a deterministic SHA-256 hex digest', () => {
      const hash1 = service.hashToken('my-token');
      const hash2 = service.hashToken('my-token');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('produces different hashes for different tokens', () => {
      expect(service.hashToken('token-a')).not.toBe(service.hashToken('token-b'));
    });
  });

  describe('rotateRefreshToken', () => {
    const sessionId = 'session-1';
    const oldToken = 'old-token';
    const newToken = 'new-token';
    const expiresAt = new Date(Date.now() + 86400000);

    it('rotates the token when old token is valid', async () => {
      const oldHash = service.hashToken(oldToken);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        sessionId,
        tokenHash: oldHash,
        revokedAt: null,
        expiresAt,
      });

      await service.rotateRefreshToken(sessionId, oldToken, newToken, expiresAt);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('revokes session and throws on token reuse', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        sessionId,
        tokenHash: service.hashToken(oldToken),
        revokedAt: new Date(), // already revoked = reuse attack
        expiresAt,
      });

      await expect(
        service.rotateRefreshToken(sessionId, oldToken, newToken, expiresAt),
      ).rejects.toThrow(TokenInvalidException);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws when token record not found', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.rotateRefreshToken(sessionId, oldToken, newToken, expiresAt),
      ).rejects.toThrow(TokenInvalidException);
    });
  });
});
