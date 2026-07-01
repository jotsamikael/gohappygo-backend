import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { NormalizeEmail } from 'src/common/transforms/normalize-email.util';

export class ForgotPasswordDto {
  @ApiProperty({ 
    description: 'User email address',
    example: 'user@example.com'
  })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Provide a valid email' })
  email: string;
}
