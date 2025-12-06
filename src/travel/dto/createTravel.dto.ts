import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, MaxLength, MinLength, IsDateString, IsBoolean, IsOptional } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateTravelDto {
  @ApiProperty({
    description: 'Description of the travel',
    example: 'Travel to London with available space for packages',
    minLength: 2,
    maxLength: 500
  })
  @IsNotEmpty({ message: 'Description can not be empty' })
  @IsString({ message: 'Description must be a string' })
  @MinLength(2, { message: 'Description must be atleast 2 charcters' })
  @MaxLength(500, { message: 'Description can not exceed 500 charcters' })
  description: string;

  @ApiProperty({
    description: 'Flight number of the travel',
    example: 'BA123',
    minLength: 2,
    maxLength: 20
  })
  @IsNotEmpty({ message: 'flightNumber can not be empty' })
  @IsString({ message: 'flightNumber must be a string' })
  @MinLength(2, { message: 'flightNumber must be atleast 2 charcters' })
  @MaxLength(20, { message: 'flightNumber can not exceed 20 charcters' })
  flightNumber: string;

  @ApiProperty({
    description: 'Whether the traveler is willing to share weight with others',
    example: true
  })
  @IsNotEmpty({ message: 'isSharedWeight can not be empty' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'isSharedWeight must be a boolean' })
  isSharedWeight: boolean;

  @ApiProperty({
    description: 'Whether this is an instant travel (immediate departure)',
    example: false
  })
  @IsNotEmpty({ message: 'isInstant can not be empty' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'isInstant must be a boolean' })
  isInstant: boolean;

  @ApiProperty({
    description: 'Whether the traveler allows extra weight beyond the limit',
    example: true
  })
  @IsNotEmpty({ message: 'isAllowExtraWeight can not be empty' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'isAllowExtraWeight must be a boolean' })
  isAllowExtraWeight: boolean;

  @ApiProperty({
    description: 'Fee charged for late comers',
    example: 10.00
  })
  @IsNotEmpty({ message: 'feeForLateComer can not be empty' })
  @Type(() => Number)
  @IsNumber({}, { message: 'feeForLateComer must be a number' })
  feeForLateComer: number;

  @ApiProperty({
    description: 'Fee charged for gloomy weather conditions',
    example: 5.00
  })
  @IsNotEmpty({ message: 'feeForGloomy can not be empty' })
  @Type(() => Number)
  @IsNumber({}, { message: 'feeForGloomy must be a number' })
  feeForGloomy: number;

  @ApiProperty({
    description: 'Departure airport id',
    example: 1
  })
  @IsNotEmpty({ message: 'departureAirportId can not be empty' })
  @Type(() => Number)
  @IsNumber({}, { message: 'departureAirportId must be a number' })
  departureAirportId: number;

  @ApiProperty({
    description: 'Arrival airport id',
    example: 2
  })
  @IsNotEmpty({ message: 'arrivalAirportId can not be empty' })
  @Type(() => Number)
  @IsNumber({}, { message: 'arrivalAirportId must be a number' })
  arrivalAirportId: number;

  @ApiProperty({
    description: 'Departure datetime',
    example: '2025-01-01T10:00:00Z'
  })
  @IsNotEmpty({ message: 'departureDatetime can not be empty' })
  @IsDateString({}, { message: 'departureDatetime must be a valid date string' })
  departureDatetime: string;

  @ApiProperty({
    description: 'Price per kg',
    example: 25.50
  })
  @IsNotEmpty({ message: 'pricePerKg can not be empty' })
  @Type(() => Number)
  @IsNumber({}, { message: 'pricePerKg must be a number' })
  pricePerKg: number;

  @ApiProperty({
    description: 'Currency ID associated with this travel',
    example: 1,
    type: 'number'
  })
  @IsNotEmpty({ message: 'currencyId can not be empty' })
  @Type(() => Number)
  @IsNumber({}, { message: 'currencyId must be a number' })
  currencyId: number;

  @ApiProperty({
    description: 'Total weight allowance in kg',
    example: 50.0
  })
  @IsNotEmpty({ message: 'totalWeightAllowance can not be empty' })
  @Type(() => Number)
  @IsNumber({}, { message: 'totalWeightAllowance must be a number' })
  totalWeightAllowance: number;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'First image file for the travel'
  })
  @IsOptional()
  image1?: any;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Second image file for the travel'
  })
  @IsOptional()
  image2?: any;
}