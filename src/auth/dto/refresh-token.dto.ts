import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token issued during sign-in or a previous refresh',
    example: 'eyJhbGci...',
  })
  @IsString()
  refreshToken: string;
}
