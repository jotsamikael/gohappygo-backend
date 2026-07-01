import { ApiProperty } from '@nestjs/swagger';

export class ResolveRequestResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Request dispute resolved successfully' })
  message: string;

  @ApiProperty({ example: 42 })
  requestId: number;
}
