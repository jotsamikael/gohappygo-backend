import { IsEmail, IsNotEmpty, IsOptional, IsPhoneNumber, IsString, MaxLength, MinLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StripeConnectCountry } from 'src/stripe/enums/stripe-connect-countries.enum';

export class RegisterDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 2,
    maxLength: 40
  })
  @IsNotEmpty({ message: 'firstName can not be empty' })
  @MinLength(2, { message: 'firstName must be atleast 2 charcters' })
  @MaxLength(40, { message: 'firstName can not exceed 40 charcters' })
  firstName: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe',
    minLength: 2,
    maxLength: 40
  })
  @IsOptional()
  @IsString({ message: 'lastName must be a string' })
  @MinLength(2, { message: 'lastName must be atleast 2 charcters' })
  @MaxLength(40, { message: 'lastName can not exceed 40 charcters' })
  lastName: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com'
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User phone number',
    example: '+237694356789'
  })
  @IsNotEmpty()
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
    minLength: 6,
    maxLength: 32
  })
  @IsNotEmpty()
  @MinLength(6, { message: 'password must be atleast 6 charcters' })
  @MaxLength(32, { message: 'password can not exceed 40 charcters' })
  password: string;

  @ApiProperty({
    description: 'Country code for Stripe Connect account (ISO 3166-1 alpha-2)',
    example: 'FR',
    enum: StripeConnectCountry,
    enumName: 'StripeConnectCountry',
  })
  @IsNotEmpty({ message: 'countryCode is required' })
  @IsEnum(StripeConnectCountry, { message: 'countryCode must be a valid Stripe Connect eligible country code' })
  countryCode: StripeConnectCountry;
}
