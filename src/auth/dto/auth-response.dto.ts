import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CurrencyResponseDto } from 'src/currency/dto/currency-response.dto';
import { ProfileStatsResponseDto } from './user-profile-response.dto';

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'John D.' })
  fullName: string;

  @ApiProperty({ example: '+1234567890' })
  phone: string;

  @ApiProperty({ example: false })
  isPhoneVerified: boolean;

  @ApiProperty({
    description: 'Whether user has submitted verification files and is awaiting admin approval',
    example: true
  })
  isAwaitingVerification: boolean;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiProperty({ example: 4.75, nullable: true })
  rating: number | null;

  @ApiProperty({ example: 15 })
  numberOfReviews: number;

  @ApiProperty({ type: CurrencyResponseDto, nullable: true })
  @Type(() => CurrencyResponseDto)
  recentCurrency: CurrencyResponseDto | null;

  @ApiProperty({ type: ProfileStatsResponseDto })
  @Type(() => ProfileStatsResponseDto)
  profileStats: ProfileStatsResponseDto;
}

export class RegisterResponseDto {
  @ApiProperty()
  user: UserResponseDto;

  @ApiProperty({ example: 'User registered successfully. Please verify your phone number.' })
  message: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refresh_token: string;

  @ApiProperty({ type: UserResponseDto })
  @Type(() => UserResponseDto)
  user: UserResponseDto;
}

export class VerifyEmailResponseDto {
  @ApiProperty({ example: 'Email verified successfully' })
  message: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refresh_token: string;

  @ApiProperty()
  user: UserResponseDto;
}

export class VerifyPhoneResponseDto {
  @ApiProperty({ example: 'Email verified successfully' })
  message: string;

  @ApiProperty()
  user: UserResponseDto;
}

export class RefreshTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;
} 


export class UploadedFileResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'selfie.jpg' })
  originalName: string;

  @ApiProperty({ example: 'https://cloudinary.com/selfie.jpg' })
  url: string;

  @ApiProperty({ example: 'SELFIE' })
  purpose: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  uploadedAt: Date;
}

export class UploadVerificationResponseDto {
  @ApiProperty({ example: 'Verification documents uploaded successfully' })
  message: string;

  @ApiProperty({ type: [UploadedFileResponseDto] })
  files: UploadedFileResponseDto[];
}