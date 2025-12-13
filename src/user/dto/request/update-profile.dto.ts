import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'First name',
    example: 'John',
    minLength: 2,
    maxLength: 40,
    required: false
  })
  @IsOptional()
  @IsString({ message: 'firstName must be a string' })
  @MinLength(2, { message: 'firstName must be at least 2 characters' })
  @MaxLength(40, { message: 'firstName cannot exceed 40 characters' })
  firstName?: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    minLength: 2,
    maxLength: 40,
    required: false
  })
  @IsOptional()
  @IsString({ message: 'lastName must be a string' })
  @MinLength(2, { message: 'lastName must be at least 2 characters' })
  @MaxLength(40, { message: 'lastName cannot exceed 40 characters' })
  lastName?: string;

  @ApiProperty({
    description: 'User bio/description',
    example: 'Frequent traveler who loves helping others',
    maxLength: 500,
    required: false
  })
  @IsOptional()
  @IsString({ message: 'bio must be a string' })
  @MaxLength(500, { message: 'bio cannot exceed 500 characters' })
  bio?: string;

  @ApiProperty({
    description: 'Phone number in international format',
    example: '+237697942923',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'phone must be a string' })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'phone must be in international format starting with + followed by country code and number (e.g., +237697942923)'
  })
  phone?: string;
}
