import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAccessPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  /**
   * Called after signature + expiry are verified by passport-jwt.
   * Session liveness is validated in AuthService.getMe / logout
   * to avoid a DB call on every single authenticated request.
   * For endpoints that require strict session validation (e.g. sensitive
   * operations), call SessionsService.findActiveByJti explicitly.
   */
  validate(payload: JwtAccessPayload): JwtAccessPayload {
    return payload;
  }
}
