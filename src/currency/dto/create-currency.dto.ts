import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateCurrencyDto {
  @ApiProperty({
    description: 'ISO 4217 currency code',
    example: 'USD',
    maxLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  code: string;

  @ApiProperty({
    description: 'Full currency name',
    example: 'US Dollar',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Currency symbol',
    example: '$',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  symbol: string;

  @ApiProperty({
    description: 'Exchange rate relative to base currency',
    example: 1.0,
    required: false,
    default: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @ApiProperty({
    description: 'Whether the currency is active',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Primary country using this currency',
    example: 'United States',
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;
}
