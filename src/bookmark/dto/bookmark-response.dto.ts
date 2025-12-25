import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class AirportResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  isDeactivated: boolean;

  @ApiProperty()
  @Expose()
  ident: string;

  @ApiProperty()
  @Expose()
  type: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  elevationFt: number;

  @ApiProperty()
  @Expose()
  continent: string;

  @ApiProperty()
  @Expose()
  isoCountry: string;

  @ApiProperty()
  @Expose()
  isoRegion: string;

  @ApiProperty()
  @Expose()
  municipality: string;
}

export class DemandImageResponseDto {
  @ApiProperty()
  @Expose()
  demandImageUrl: string;
}


export class BookmarkAirlineResponseDto {
  @ApiProperty()
  @Expose()
  airlineId: number;
  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  logoUrl: string;
}

export class UserResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  isDeactivated: boolean;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty()
  @Expose()
  phone: string;

  @ApiProperty()
  @Expose()
  firstName: string;

  @ApiProperty()
  @Expose()
  lastName: string;

  @ApiProperty({ example: 'John D.' })
  @Expose()
  fullName: string;

  @ApiProperty()
  @Expose()
  profilePictureUrl: string;
}

export class TravelResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  createdBy: number | null;


  @ApiProperty()
  @Expose()
  isDeactivated: boolean;

  @ApiProperty()
  @Expose()
  userId: number;

  @ApiProperty()  
  @Expose()
  description: string;

  @ApiProperty()
  @Expose()
  flightNumber: string;

  @ApiProperty()
  @Expose()
  isSharedWeight: boolean;

  @ApiProperty()
  @Expose()
  isInstant: boolean;

  @ApiProperty()
  @Expose()
  isAllowExtraWeight: boolean;

  @ApiProperty()
  @Expose()
  punctualityLevel: boolean;

  @ApiProperty()
  @Expose()
  feeForGloomy: string;

  @ApiProperty()
  @Expose()
  airlineId: number;

  @ApiProperty()
  @Expose()
  departureAirportId: number;

  @ApiProperty()
  @Expose()
  arrivalAirportId: number;

  @ApiProperty()
  @Expose()
  departureDatetime: Date;

  @ApiProperty()
  @Expose()
  totalWeightAllowance: string;

  @ApiProperty()
  @Expose()
  weightAvailable: string;

  @ApiProperty()
  @Expose()
  pricePerKg: string;

  @ApiProperty()  
  @Expose()
  status: string;

  @ApiProperty({ type: AirportResponseDto, nullable: true })
  @Expose()
  @Type(() => AirportResponseDto)
  departureAirport: AirportResponseDto | null;

  @ApiProperty({ type: AirportResponseDto, nullable: true })
  @Expose()
  @Type(() => AirportResponseDto)
  arrivalAirport: AirportResponseDto | null;

  @ApiProperty({ type: UserResponseDto, nullable: true })
  @Expose()
  @Type(() => UserResponseDto)
  user: UserResponseDto | null;

  @ApiProperty({ type: BookmarkAirlineResponseDto, nullable: true })
  @Expose()
  @Type(() => BookmarkAirlineResponseDto)
  airline: BookmarkAirlineResponseDto | null;
}

export class DemandResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  createdBy: number | null;

  @ApiProperty()
  @Expose()
  isDeactivated: boolean;

  @ApiProperty()
  @Expose()
  userId: number;

  @ApiProperty()
  @Expose()
  description: string;

  @ApiProperty()
  @Expose()
  departureAirportId: number;

  @ApiProperty()
  @Expose()
  arrivalAirportId: number;

  @ApiProperty()  
  @Expose()
  departureDatetime: Date;

  @ApiProperty()
  @Expose()
  weight: string;

  @ApiProperty()
  @Expose()
  pricePerKg: string;

  @ApiProperty()
  @Expose()
  status: string;

  @ApiProperty({ type: AirportResponseDto, nullable: true })
  @Expose()
  @Type(() => AirportResponseDto)
  departureAirport: AirportResponseDto | null;

  @ApiProperty({ type: AirportResponseDto, nullable: true })
  @Expose()
  @Type(() => AirportResponseDto)
  arrivalAirport: AirportResponseDto | null;

  @ApiProperty({ type: UserResponseDto, nullable: true })
  @Expose()
  @Type(() => UserResponseDto)
  user: UserResponseDto | null;
}

export class BookmarkItemResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  userId: number;

  @ApiProperty()
  @Expose()
  bookmarkType: string;

  @ApiProperty()
  @Expose()
  travelId: number | null;

  @ApiProperty()
  @Expose()
  demandId: number | null;

  @ApiProperty()
  @Expose()
  notes: string | null;

  @ApiProperty({ type: TravelResponseDto, nullable: true })
  @Expose()
  @Type(() => TravelResponseDto)
  travel: TravelResponseDto | null;

  @ApiProperty({ type: DemandResponseDto, nullable: true })
  @Expose()
  @Type(() => DemandResponseDto)
  demand: DemandResponseDto | null;

  @ApiProperty({ type: BookmarkAirlineResponseDto, nullable: true })
  @Expose()
  @Type(() => BookmarkAirlineResponseDto)
  airline: BookmarkAirlineResponseDto | null;

  @ApiProperty({ type: DemandImageResponseDto, nullable: true })
  @Expose()
  @Type(() => DemandImageResponseDto)
  demandImage: DemandImageResponseDto | null;
}

export class BookmarkListResponseDto {
  @ApiProperty({ type: [BookmarkItemResponseDto] })
  items: BookmarkItemResponseDto[];

  @ApiProperty()
  meta: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
