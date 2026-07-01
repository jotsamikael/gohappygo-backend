import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, Matches } from 'class-validator';
import { NormalizeEmail } from 'src/common/transforms/normalize-email.util';

export enum VerificationType {
  EMAIL = 'email',
  PHONE = 'phone'
}

export class ResendVerificationDto {
  @ApiProperty({ description: 'User email address' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({ 
    description: 'Type of verification to resend',
    enum: VerificationType
  })
  @IsEnum(VerificationType)
  type: VerificationType;
}
