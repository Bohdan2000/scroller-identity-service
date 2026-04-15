import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtRefreshPayload } from '../interfaces/jwt-payload.interface';

export interface JwtRefreshUser extends JwtRefreshPayload {
  rawToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      // Refresh token arrives in the request body
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    });
  }

  validate(
    req: { body: Record<string, string> },
    payload: JwtRefreshPayload,
  ): JwtRefreshUser {
    return { ...payload, rawToken: req.body['refreshToken'] };
  }
}
