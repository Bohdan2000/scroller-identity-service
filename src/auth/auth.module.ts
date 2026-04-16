import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { TokensModule } from '../tokens/tokens.module';
import { SessionsModule } from '../sessions/sessions.module';
import { DevicesModule } from '../devices/devices.module';
import { OAuthModule } from '../oauth/oauth.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt-access' }),
    TokensModule,
    SessionsModule,
    DevicesModule,
    OAuthModule,
    EventsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy, JwtRefreshStrategy],
})
export class AuthModule {}
