import { HttpException, HttpStatus } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus,
    public readonly code: string,
  ) {
    super({ message, code, statusCode }, statusCode);
  }
}

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('Invalid email or password', HttpStatus.UNAUTHORIZED, 'AUTH_001');
  }
}

export class EmailAlreadyExistsException extends DomainException {
  constructor() {
    super('Email already registered', HttpStatus.CONFLICT, 'AUTH_002');
  }
}

export class AccountBlockedException extends DomainException {
  constructor() {
    super('Account has been blocked', HttpStatus.FORBIDDEN, 'AUTH_003');
  }
}

export class TokenExpiredException extends DomainException {
  constructor() {
    super('Token has expired', HttpStatus.UNAUTHORIZED, 'AUTH_004');
  }
}

export class TokenInvalidException extends DomainException {
  constructor() {
    super('Token is invalid or revoked', HttpStatus.UNAUTHORIZED, 'AUTH_005');
  }
}

export class SessionNotFoundException extends DomainException {
  constructor() {
    super('Session not found or revoked', HttpStatus.UNAUTHORIZED, 'AUTH_006');
  }
}

export class OAuthProviderException extends DomainException {
  constructor(message = 'OAuth provider verification failed') {
    super(message, HttpStatus.BAD_GATEWAY, 'AUTH_007');
  }
}

export class PasswordResetTokenInvalidException extends DomainException {
  constructor() {
    super(
      'Password reset token is invalid or expired',
      HttpStatus.BAD_REQUEST,
      'AUTH_008',
    );
  }
}
