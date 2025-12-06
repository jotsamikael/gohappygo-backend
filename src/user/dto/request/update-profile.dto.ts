import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
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
}
