import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";
import { NormalizeEmail } from 'src/common/transforms/normalize-email.util';

export class ResendEmailVerificationDto {
  @ApiProperty({ description: 'User email address' })
  @NormalizeEmail()
  @IsEmail()
  email: string;
}
