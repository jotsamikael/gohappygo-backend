import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UnregisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM device token to unregister', minLength: 20, maxLength: 512 })
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  fcmToken: string;
}
