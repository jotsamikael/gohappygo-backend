import { ApiProperty } from '@nestjs/swagger';

export class RegisterDeviceTokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: '2026-05-30T12:00:00.000Z' })
  registeredAt: Date;
}
