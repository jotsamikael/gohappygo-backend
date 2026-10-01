// change-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MaxLength, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123!',
    minLength: 6,
    maxLength: 128
  })
  @IsNotEmpty({ message: 'Current password is required' })
  @MaxLength(128, { message: 'Current password cannot exceed 128 characters' })
  currentPassword: string;

  @ApiProperty({
    description: 'New password - must contain at least one uppercase letter, one lowercase letter, one number',
    example: 'NewPassword123!',
    minLength: 8,
    maxLength: 128
  })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @MaxLength(128, { message: 'New password cannot exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]/,
    { 
      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
    }
  )
  newPassword: string;
}
