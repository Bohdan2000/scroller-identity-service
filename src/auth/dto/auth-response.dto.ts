import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ example: '6c29d607-705d-42ed-8492-2a515de37266' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: false })
  emailVerified: boolean;

  @ApiProperty({ example: 'active', enum: ['active', 'blocked'] })
  status: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived JWT access token (15 min)', example: 'eyJhbGci...' })
  accessToken: string;

  @ApiProperty({ description: 'Long-lived refresh token (7 days)', example: 'eyJhbGci...' })
  refreshToken: string;

  @ApiProperty({ description: 'Access token lifetime in seconds', example: 900 })
  expiresIn: number;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ type: () => UserDto })
  user: UserDto;
}
