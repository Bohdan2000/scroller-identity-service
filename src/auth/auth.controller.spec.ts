import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';

const mockAuthService = {
  signUp: jest.fn(),
  signIn: jest.fn(),
  oauthGoogle: jest.fn(),
  oauthApple: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  getMe: jest.fn(),
};

const mockFastifyRequest = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'Jest/1.0' },
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('delegates signUp to AuthService', async () => {
    const dto = { email: 'test@example.com', password: 'Password1' };
    const expected = { accessToken: 'tok' };
    mockAuthService.signUp.mockResolvedValue(expected);

    const result = await controller.signUp(dto, mockFastifyRequest as never);

    expect(mockAuthService.signUp).toHaveBeenCalledWith(
      dto,
      expect.objectContaining({ ip: '127.0.0.1' }),
    );
    expect(result).toBe(expected);
  });

  it('delegates signIn to AuthService', async () => {
    const dto = { email: 'test@example.com', password: 'Password1' };
    const expected = { accessToken: 'tok' };
    mockAuthService.signIn.mockResolvedValue(expected);

    const result = await controller.signIn(dto, mockFastifyRequest as never);

    expect(mockAuthService.signIn).toHaveBeenCalledWith(
      dto,
      expect.objectContaining({ ip: '127.0.0.1' }),
    );
    expect(result).toBe(expected);
  });

  it('delegates refresh to AuthService', async () => {
    const dto = { refreshToken: 'rt' };
    const expected = { accessToken: 'new-tok' };
    mockAuthService.refresh.mockResolvedValue(expected);

    const result = await controller.refresh(dto);

    expect(result).toBe(expected);
  });

  it('delegates logout to AuthService using jti from payload', async () => {
    const payload = { sub: 'user-1', email: 'x@x.com', jti: 'jti-1' };
    mockAuthService.logout.mockResolvedValue(undefined);

    await controller.logout(payload, { refreshToken: 'rt' });

    expect(mockAuthService.logout).toHaveBeenCalledWith('jti-1', 'rt');
  });

  it('delegates getMe to AuthService', async () => {
    const payload = { sub: 'user-1', email: 'x@x.com', jti: 'jti-1' };
    const expected = { id: 'user-1', email: 'x@x.com' };
    mockAuthService.getMe.mockResolvedValue(expected);

    const result = await controller.me(payload);

    expect(result).toBe(expected);
  });
});
