import { IsEnum, IsNotEmpty, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { StripeConnectCountry } from 'src/stripe/enums/stripe-connect-countries.enum';

export class CompleteSocialRegistrationDto {
  @ApiProperty({
    description: 'Country code for Stripe Connect account (ISO 3166-1 alpha-2)',
    example: 'FR',
    enum: StripeConnectCountry,
    enumName: 'StripeConnectCountry',
  })
  @IsNotEmpty({ message: 'countryCode is required' })
  @IsEnum(StripeConnectCountry, { message: 'countryCode must be a valid Stripe Connect eligible country code' })
  countryCode: StripeConnectCountry;

  @ApiProperty({
    description: 'User phone number',
    example: '+237694356789',
  })
  @IsNotEmpty({ message: 'phoneNumber is required' })
  @IsPhoneNumber(undefined, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber: string;
}
