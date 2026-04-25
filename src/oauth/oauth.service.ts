import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { OAuthProviderException } from '../common/exceptions/domain.exceptions';

export interface OAuthUserInfo {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly googleClient: OAuth2Client;

  constructor(private readonly config: ConfigService) {
    this.googleClient = new OAuth2Client(
      config.getOrThrow<string>('oauth.google.clientId'),
    );
  }

  async verifyGoogleToken(idToken: string): Promise<OAuthUserInfo> {
    try {
      const webClientId = this.config.getOrThrow<string>('oauth.google.clientId');
      const iosClientId = this.config.get<string>('oauth.google.iosClientId');
      const androidClientId = this.config.get<string>('oauth.google.androidClientId');
      const audience = [webClientId, iosClientId, androidClientId].filter(Boolean) as string[];

      const ticket = await this.googleClient.verifyIdToken({ idToken, audience });

      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email) {
        throw new OAuthProviderException('Invalid Google token payload');
      }

      return {
        providerUserId: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified ?? false,
      };
    } catch (err) {
      if (err instanceof OAuthProviderException) throw err;
      this.logger.warn('Google token verification failed', err);
      throw new OAuthProviderException('Google token verification failed');
    }
  }

  async verifyAppleToken(identityToken: string): Promise<OAuthUserInfo> {
    try {
      const claims = await appleSignin.verifyIdToken(identityToken, {
        audience: this.config.getOrThrow<string>('oauth.apple.clientId'),
        ignoreExpiration: false,
      });

      if (!claims.sub || !claims.email) {
        throw new OAuthProviderException('Invalid Apple token payload');
      }

      return {
        providerUserId: claims.sub,
        email: claims.email.toLowerCase(),
        // Apple returns email_verified as a string "true"/"false"
        emailVerified: claims.email_verified === 'true' || claims.email_verified === true,
      };
    } catch (err) {
      if (err instanceof OAuthProviderException) throw err;
      this.logger.warn('Apple token verification failed', err);
      throw new OAuthProviderException('Apple token verification failed');
    }
  }
}
