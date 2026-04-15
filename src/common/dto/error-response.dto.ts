import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: 'AUTH_001', description: 'Machine-readable error code' })
  code: string;

  @ApiProperty({ example: 'Invalid email or password' })
  message: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/v1/auth/sign-in' })
  path: string;
}
