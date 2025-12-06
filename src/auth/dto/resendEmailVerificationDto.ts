import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ResendEmailVerificationDto {
  @ApiProperty({ description: 'User email address' })
  @IsEmail()
  email: string;
}
