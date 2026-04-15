import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OAuthAppleDto {
  @ApiProperty({
    description: 'Identity token (JWT) returned by Apple Sign-In on the client',
    example: 'eyJhbGci...',
  })
  @IsString()
  identityToken: string;

  @ApiPropertyOptional({
    description: 'Short-lived authorization code from Apple (optional — for server-side validation flows)',
    example: 'c1a2b3d4...',
  })
  @IsOptional()
  @IsString()
  authorizationCode?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-device-uuid' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;

  @ApiPropertyOptional({ example: 'ios', enum: ['ios', 'android', 'web'] })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  @ApiPropertyOptional({ example: '2.1.0' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;
}
