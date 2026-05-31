import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';

export class CreateAirlineDto {
  @ApiProperty({ description: 'ICAO code (3-4 letters)', example: 'AFR' })
  @IsString()
  @MaxLength(4)
  icaoCode: string;

  @ApiProperty({ description: 'IATA code (2 letters)', example: 'AF', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  iataCode?: string;

  @ApiProperty({ description: 'Airline name', example: 'Air France' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Airline prefix', example: 'AFR', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  prefix?: string;

  @ApiProperty({ description: 'Fleet size', example: 250, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fleetSize?: number;

  @ApiProperty({ description: 'Number of destinations', example: 200, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  destinationsCount?: number;

  @ApiProperty({ description: 'Callsign', example: 'AIRFRANS', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  callsign?: string;

  @ApiProperty({ description: 'Wikipedia URL', example: 'https://en.wikipedia.org/wiki/Air_France', required: false })
  @IsOptional()
  @IsString()
  wikipediaUrl?: string;
}
