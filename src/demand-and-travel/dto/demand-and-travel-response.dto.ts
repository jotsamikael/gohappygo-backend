import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { PackageKind } from 'src/demand/package-kind.enum';

export class UserNameResponseDto {
  
  @ApiProperty({ description: 'User ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Formatted user name (e.g., "John D.")' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'Full name (e.g., "John D.")' })
  @Expose()
  fullName: string;

  @ApiProperty({ description: 'User selfie image URL', required: false })
  @Expose()
  selfieImage?: string;

  @ApiProperty({ description: 'User account creation date' })
  @Expose()
  createdAt: Date;
  
  @ApiProperty({ description: 'Whether user is verified (KYC completed)' })
  @Expose()
  isVerified: boolean;

  @ApiProperty({ description: 'Average rating received by user', example: 4.75, nullable: true })
  @Expose()
  rating: number | null;

  @ApiProperty({ description: 'Total number of reviews received', example: 15 })
  @Expose()
  numberOfReviews: number;
}

export class ImageResponseDto {
  @ApiProperty({ description: 'Image ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Image file URL' })
  @Expose()
  fileUrl: string;

  @ApiProperty({ description: 'Original file name' })
  @Expose()
  originalName: string;

  @ApiProperty({ description: 'File purpose (e.g., DEMAND_IMAGE_1, TRAVEL_IMAGE_1)' })
  @Expose()
  purpose: string;
}

// Add airport DTO
export class AirportSimpleResponseDto {
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

// Add Airline DTO
export class AirlineSimpleResponseDto {
  @ApiProperty({ description: 'Airline ID', required: false })
  @Expose()
  airlineId?: number;

  @ApiProperty({ description: 'Airline name', required: false })
  @Expose()
  name?: string;

  @ApiProperty({ description: 'Airline logo URL', required: false })
  @Expose()
  logoUrl?: string;
}

// Update DemandOrTravelResponseDto to include airline
export class DemandOrTravelResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Type of item (demand or travel)', enum: ['demand', 'travel'] })
  @Expose()
  type: 'demand' | 'travel';

  @ApiProperty({ description: 'Title of the demand or travel' })
  @Expose()
  title: string;

  @ApiProperty({ description: 'Description of the demand or travel' })
  @Expose()
  description: string;

  @ApiProperty({ description: 'Flight number' })
  @Expose()
  flightNumber: string;

  @ApiProperty({ description: 'Origin airport ID' })
  @Expose()
  departureAirportId: number;

  @ApiProperty({ description: 'Destination airport ID' })
  @Expose()
  arrivalAirportId: number;
  
  // Add airport details
  @ApiProperty({ type: AirportSimpleResponseDto, description: 'Departure airport details', required: false, nullable: true })
  @Expose()
  @Type(() => AirportSimpleResponseDto)
  departureAirport?: AirportSimpleResponseDto | null;

  @ApiProperty({ type: AirportSimpleResponseDto, description: 'Arrival airport details', required: false, nullable: true })
  @Expose()
  @Type(() => AirportSimpleResponseDto)
  arrivalAirport?: AirportSimpleResponseDto | null;

  @ApiProperty({ type: AirlineSimpleResponseDto, description: 'Airline details', required: false, nullable: true })
  @Expose()
  @Type(() => AirlineSimpleResponseDto)
  airline?: AirlineSimpleResponseDto | null;

  @ApiProperty({ description: 'User ID who created this item' })
  @Expose()
  userId: number;

  @ApiProperty({ description: 'Status of the item', enum: ['active', 'expired', 'cancelled', 'resolved'] })
  @Expose()
  status: string;

  @ApiProperty({ description: 'Delivery date' })
  @Expose()
  deliveryDate: Date;

  @ApiProperty({ description: 'Creation date' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ description: 'Weight (demands only)', required: false })
  @Expose()
  weight?: number;

  @ApiProperty({ description: 'Price per kg (demands only)', required: false })
  @Expose()
  pricePerKg?: number;

  @ApiProperty({ description: 'Weight available (travels only)', required: false })
  @Expose()
  weightAvailable?: number;

  @ApiProperty({ description: 'Whether the item is deactivated' })
  @Expose()
  isDeactivated: boolean;
  
  @ApiProperty({ description: 'Package kind (demands only)', required: false })
  @Expose()
  packageKind?: PackageKind;

  // New attributes for travels
  @ApiProperty({ description: 'Whether weight is shared (travels only)', required: false })
  @Expose()
  isSharedWeight?: boolean;

  @ApiProperty({ description: 'Whether instant booking is allowed (travels only)', required: false })
  @Expose()
  isInstant?: boolean;

  @ApiProperty({ description: 'Whether extra weight is allowed (travels only)', required: false })
  @Expose()
  isAllowExtraWeight?: boolean;

  @ApiProperty({ description: 'Fee for late comer (travels only)', required: false })
  @Expose()
  feeForLateComer?: number;

  @ApiProperty({ description: 'Fee for gloomy weather (travels only)', required: false })
  @Expose()
  feeForGloomy?: number;

  @ApiProperty({ type: UserNameResponseDto, description: 'User information with formatted name' })
  @Expose()
  @Type(() => UserNameResponseDto)
  user: UserNameResponseDto;

  @ApiProperty({ type: [ImageResponseDto], description: 'Images associated with this demand or travel' })
  @Expose()
  @Type(() => ImageResponseDto)
  images: ImageResponseDto[];

  @ApiProperty({ description: 'Whether the current user has bookmarked this item' })
  @Expose()
  isBookmarked: boolean;
}

export class PaginatedDemandsAndTravelsResponseDto implements PaginatedResponse<DemandOrTravelResponseDto> {
  @ApiProperty({ type: [DemandOrTravelResponseDto], description: 'Array of demands and travels' })
  items: DemandOrTravelResponseDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  meta: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
