import { IsString, IsOptional, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AppleFullNameDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}

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

  @ApiPropertyOptional({
    description: 'Full name from Apple — only sent on the very first authorization',
    type: () => AppleFullNameDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AppleFullNameDto)
  fullName?: AppleFullNameDto;
}
