import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAirportDto {
  @ApiProperty({
    description: 'Unique airport identifier (e.g. ICAO/GPS code)',
    example: 'KJFK',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  ident: string;

  @ApiProperty({
    description: 'Airport type',
    example: 'large_airport',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @ApiProperty({
    description: 'Airport name',
    example: 'John F Kennedy International Airport',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Latitude in decimal degrees',
    example: 40.6413,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitudeDeg?: number;

  @ApiProperty({
    description: 'Longitude in decimal degrees',
    example: -73.7781,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitudeDeg?: number;

  @ApiProperty({
    description: 'Continent code',
    example: 'NA',
    required: false,
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  continent?: string;

  @ApiProperty({
    description: 'ISO country code',
    example: 'US',
    required: false,
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  isoCountry?: string;

  @ApiProperty({
    description: 'ISO region code',
    example: 'US-NY',
    required: false,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isoRegion?: string;

  @ApiProperty({
    description: 'City or municipality served by the airport',
    example: 'New York',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  municipality?: string;

  @ApiProperty({
    description: 'ICAO code',
    example: 'KJFK',
    required: false,
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icaoCode?: string;

  @ApiProperty({
    description: 'IATA code',
    example: 'JFK',
    required: false,
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  iataCode?: string;

  @ApiProperty({
    description: 'GPS code',
    example: 'KJFK',
    required: false,
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  gpsCode?: string;

  @ApiProperty({
    description: 'Local code',
    example: 'JFK',
    required: false,
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  localCode?: string;

  @ApiProperty({
    description: 'Official airport website URL',
    example: 'https://www.jfkairport.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  homeLink?: string;
}
