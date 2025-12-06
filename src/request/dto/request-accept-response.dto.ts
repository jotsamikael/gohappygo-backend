import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

// User DTO for request responses (limited fields)
export class RequestUserDto {
  @ApiProperty({ example: 29 })
  @Expose()
  id: number;

  @ApiProperty({ example: '2025-09-13T19:44:29.010Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: false })
  @Expose()
  isDeactivated: boolean;

  @ApiProperty({ example: 'jotsamikael0@gmail.com' })
  @Expose()
  email: string;

  @ApiProperty({ example: '+237697942923' })
  @Expose()
  phone: string;

  @ApiProperty({ example: 'James' })
  @Expose()
  firstName: string;

  @ApiProperty({ example: 'Deanili' })
  @Expose()
  lastName: string;

  @ApiProperty({ example: 'James D.' })
  @Expose()
  fullName: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/...' })
  @Expose()
  profilePictureUrl: string;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  currencyId: number | null;
}

// Travel DTO for request responses
export class RequestTravelDto {
  @ApiProperty({ example: 32 })
  @Expose()
  id: number;

  @ApiProperty({ example: '2025-12-02T16:12:34.176Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2025-12-02T16:12:34.176Z' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ example: 29 })
  @Expose()
  createdBy: number;

  @ApiProperty({ example: false })
  @Expose()
  isDeactivated: boolean;

  @ApiProperty({ example: 29 })
  @Expose()
  userId: number;

  @ApiProperty({ example: 'Travelling to Senegal for holidays' })
  @Expose()
  description: string;

  @ApiProperty({ example: 'HC6579' })
  @Expose()
  flightNumber: string;

  @ApiProperty({ example: true })
  @Expose()
  isSharedWeight: boolean;

  @ApiProperty({ example: false })
  @Expose()
  isInstant: boolean;

  @ApiProperty({ example: true })
  @Expose()
  isAllowExtraWeight: boolean;

  @ApiProperty({ example: '3.00' })
  @Expose()
  feeForLateComer: string;

  @ApiProperty({ example: '2.00' })
  @Expose()
  feeForGloomy: string;

  @ApiProperty({ example: 782 })
  @Expose()
  airlineId: number;

  @ApiProperty({ example: 41401 })
  @Expose()
  departureAirportId: number;

  @ApiProperty({ example: 31061 })
  @Expose()
  arrivalAirportId: number;

  @ApiProperty({ example: '2025-12-24T10:30:00.000Z' })
  @Expose()
  departureDatetime: Date;

  @ApiProperty({ example: '20.00' })
  @Expose()
  totalWeightAllowance: string;

  @ApiProperty({ example: '20.00' })
  @Expose()
  weightAvailable: string;

  @ApiProperty({ example: '4.00' })
  @Expose()
  pricePerKg: string;

  @ApiProperty({ example: 3 })
  @Expose()
  currencyId: number;

  @ApiProperty({ example: 'active' })
  @Expose()
  status: string;

  @ApiProperty({ type: RequestUserDto })
  @Expose()
  @Type(() => RequestUserDto)
  user: RequestUserDto;
}

// Main request accept response DTO
export class RequestAcceptResponseDto {
  @ApiProperty({ example: 15 })
  @Expose()
  id: number;

  @ApiProperty({ example: '2025-12-03T09:47:37.401Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2025-12-03T10:10:50.000Z' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  deletedAt: Date | null;

  @ApiProperty({ example: 43 })
  @Expose()
  createdBy: number;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  updatedBy: number | null;

  @ApiProperty({ example: false })
  @Expose()
  isDeactivated: boolean;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  demandId: number | null;

  @ApiProperty({ example: 32 })
  @Expose()
  travelId: number;

  @ApiProperty({ example: 43 })
  @Expose()
  requesterId: number;

  @ApiProperty({ example: 'GoAndGo' })
  @Expose()
  requestType: string;

  @ApiProperty({ example: '2.00' })
  @Expose()
  weight: string;

  @ApiProperty({ example: 1 })
  @Expose()
  currentStatusId: number;

  @ApiProperty({ type: RequestTravelDto, nullable: true })
  @Expose()
  @Type(() => RequestTravelDto)
  travel: RequestTravelDto | null;

  @ApiProperty({ nullable: true })
  @Expose()
  demand: any | null;
}

