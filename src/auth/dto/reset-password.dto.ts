import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'New password',
    example: 'newpassword123',
    minLength: 6,
    maxLength: 16
  })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(16, { message: 'Password cannot be more than 16 characters long' })
  password: string;
}
