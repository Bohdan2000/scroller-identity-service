import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokensService } from './tokens.service';

@Module({
  imports: [
    // Secrets are injected per-call via signAsync options — no global secret needed here
    JwtModule.register({}),
  ],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
