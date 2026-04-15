import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadGatewayResponse,
  ApiBody,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { OAuthGoogleDto } from './dto/oauth-google.dto';
import { OAuthAppleDto } from './dto/oauth-apple.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { AuthResponseDto, UserDto } from './dto/auth-response.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAccessPayload } from './interfaces/jwt-payload.interface';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a user account with email + password credentials and returns a token pair.',
  })
  @ApiCreatedResponse({ type: AuthResponseDto, description: 'Account created' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Email already registered (AUTH_002)' })
  signUp(
    @Body() dto: SignUpDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    return this.authService.signUp(dto, this.extractDeviceContext(req));
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with email & password',
    description: 'Validates credentials and returns a new token pair.',
  })
  @ApiOkResponse({ type: AuthResponseDto, description: 'Authenticated' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Invalid credentials (AUTH_001)' })
  @ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Account blocked (AUTH_003)' })
  signIn(
    @Body() dto: SignInDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    return this.authService.signIn(dto, this.extractDeviceContext(req));
  }

  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in / register with Google',
    description:
      'Verifies a Google ID token server-side. Creates the user if not found; ' +
      'links the Google identity to an existing account if the email matches.',
  })
  @ApiOkResponse({ type: AuthResponseDto, description: 'Authenticated' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Token invalid (AUTH_005)' })
  @ApiBadGatewayResponse({ type: ErrorResponseDto, description: 'Google verification failed (AUTH_007)' })
  oauthGoogle(
    @Body() dto: OAuthGoogleDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    return this.authService.oauthGoogle(dto, this.extractDeviceContext(req));
  }

  @Post('oauth/apple')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in / register with Apple',
    description:
      'Verifies an Apple identity token server-side. Creates the user if not found; ' +
      'links the Apple identity to an existing account if the email matches.',
  })
  @ApiOkResponse({ type: AuthResponseDto, description: 'Authenticated' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Token invalid (AUTH_005)' })
  @ApiBadGatewayResponse({ type: ErrorResponseDto, description: 'Apple verification failed (AUTH_007)' })
  oauthApple(
    @Body() dto: OAuthAppleDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthResponseDto> {
    return this.authService.oauthApple(dto, this.extractDeviceContext(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate tokens',
    description:
      'Exchanges a valid refresh token for a new access + refresh token pair. ' +
      'The old refresh token is immediately revoked (rotation). ' +
      'Reuse of a previously rotated token revokes the entire session.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: AuthResponseDto, description: 'New token pair issued' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Refresh token invalid, expired, or reused (AUTH_005 / AUTH_006)',
  })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke the current session',
    description:
      'Revokes the active session associated with the bearer token. ' +
      'Optionally accepts the refresh token to immediately invalidate it as well.',
  })
  @ApiNoContentResponse({ description: 'Session revoked' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Access token invalid (AUTH_005)' })
  logout(
    @CurrentUser() user: JwtAccessPayload,
    @Body() dto: LogoutDto,
  ): Promise<void> {
    return this.authService.logout(user.jti, dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the authenticated user',
    description:
      'Returns identity data for the owner of the bearer token. ' +
      'Performs a full session liveness check — returns 401 if the session has been revoked.',
  })
  @ApiOkResponse({ type: UserDto, description: 'Current user' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Token invalid or session revoked (AUTH_005 / AUTH_006)',
  })
  me(@CurrentUser() user: JwtAccessPayload): Promise<AuthResponseDto['user']> {
    return this.authService.getMe(user);
  }

  private extractDeviceContext(req: FastifyRequest) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
