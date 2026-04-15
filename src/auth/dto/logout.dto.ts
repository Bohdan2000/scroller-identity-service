import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'Providing the refresh token allows immediate revocation of the refresh token ' +
      'record in addition to the session. Omitting it still revokes the session — ' +
      'the refresh token will naturally fail on next use.',
    example: 'eyJhbGci...',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
