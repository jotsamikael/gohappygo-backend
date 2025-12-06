import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'User email address',example:'jotsamikael@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: '6-digit verification code sent to email' })
  @IsString()
  @Length(6, 6)
  verificationCode: string;
}