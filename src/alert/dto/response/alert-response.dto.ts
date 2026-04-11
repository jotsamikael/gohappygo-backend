import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { AlertType } from '../../entities/alert.entity';

export class AlertAirportResponseDto {
  @ApiProperty({ description: 'Airport ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Airport name' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'Airport municipality/city', required: false })
  @Expose()
  municipality: string | null;

  @ApiProperty({ description: 'ISO country code', required: false })
  @Expose()
  isoCountry: string | null;
}

export class AlertUserResponseDto {
  @ApiProperty({ description: 'User ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'User email' })
  @Expose()
  email: string;

  @ApiProperty({ description: 'Display name (Firstname L.)' })
  @Expose()
  fullName: string;
}

export class AlertResponseDto {
  @ApiProperty({ description: 'Alert ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'User ID who created the alert' })
  @Expose()
  userId: number;

  @ApiProperty({ description: 'Departure airport ID' })
  @Expose()
  departureAirportId: number;

  @ApiProperty({ description: 'Arrival airport ID' })
  @Expose()
  arrivalAirportId: number;

  @ApiProperty({ enum: AlertType, description: 'Alert type (DEMAND, TRAVEL, or BOTH)' })
  @Expose()
  alertType: AlertType;

  @ApiProperty({ description: 'Flight number (optional)', required: false, nullable: true })
  @Expose()
  flightNumber: string | null;

  @ApiProperty({ description: 'Travel date time (optional)', required: false, nullable: true })
  @Expose()
  travelDateTime: Date | null;

  @ApiProperty({ type: AlertAirportResponseDto, description: 'Departure airport details' })
  @Expose()
  @Type(() => AlertAirportResponseDto)
  departureAirport: AlertAirportResponseDto;

  @ApiProperty({ type: AlertAirportResponseDto, description: 'Arrival airport details' })
  @Expose()
  @Type(() => AlertAirportResponseDto)
  arrivalAirport: AlertAirportResponseDto;

  @ApiProperty({ type: AlertUserResponseDto, description: 'User who created the alert' })
  @Expose()
  @Type(() => AlertUserResponseDto)
  user: AlertUserResponseDto;

  @ApiProperty({ description: 'Creation date' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  @Expose()
  updatedAt: Date;
}
