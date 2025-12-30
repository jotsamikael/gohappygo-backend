import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { AlertType } from '../../entities/alert.entity';
import { Type } from 'class-transformer';

export class CreateAlertDto {
  @ApiProperty({
    description: 'Departure airport id',
    example: 3045,
    required: true,
  })
  @IsNotEmpty({ message: 'departureAirportId can not be empty' })
  @Type(() => Number)
  @IsNumber({}, { message: 'departureAirportId must be a number' })
  departureAirportId: number;

  @ApiProperty({
    description: 'Arrival airport id',
    example: 2471,
    required: true,
  })
  @IsNotEmpty({ message: 'arrivalAirportId can not be empty' })
  @Type(() => Number)
  @IsNumber({}, { message: 'arrivalAirportId must be a number' })
  arrivalAirportId: number;

  @ApiProperty({
    enum: AlertType,
    default: AlertType.TRAVEL,
    description: 'AlertType can be DEMAND, TRAVEL or BOTH',
    required: false,
  })
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;

  @ApiProperty({
    description: 'Flight number (optional)',
    example: 'AF123',
    required: false,
  })
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiProperty({
    description: 'travel date time',
    example: '2025-01-01T10:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'travel date time must be a valid date string' })
  travelDateTime?: string;
}
