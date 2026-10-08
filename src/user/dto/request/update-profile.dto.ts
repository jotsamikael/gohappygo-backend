import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsPhoneNumber,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    description:
      'First name. Cannot be changed after Didit KYC verification (isVerified=true).',
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
    description:
      'Last name. Cannot be changed after Didit KYC verification (isVerified=true).',
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
    description:
      'Phone number in international format. Can only be changed before Didit KYC verification (isVerified=false).',
    example: '+33612345678',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber(undefined, { message: 'phone must be a valid phone number' })
  @MaxLength(20, { message: 'phone cannot exceed 20 characters' })
  phone?: string;
}
