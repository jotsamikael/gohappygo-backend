import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DevicePlatform } from '../entities/user-device-token.entity';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM device token from Firebase SDK', minLength: 20, maxLength: 512 })
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  fcmToken: string;

  @ApiProperty({ enum: DevicePlatform, description: 'Device platform' })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiProperty({ description: 'Optional stable device identifier from client', required: false, maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;
}
