import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OAuthGoogleDto {
  @ApiProperty({
    description: 'Google ID token obtained from the Google Sign-In SDK on the client',
    example: 'eyJhbGci...',
  })
  @IsString()
  idToken: string;

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
