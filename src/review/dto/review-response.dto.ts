import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

// User info for review response
export class ReviewUserDto {
  @ApiProperty({ example: 30 })
  @Expose()
  id: number;

  @ApiProperty({ example: '2025-10-09T18:07:14.516Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: 'Peter' })
  @Expose()
  firstName: string;

  @ApiProperty({ example: 'till' })
  @Expose()
  lastName: string;

  @ApiProperty({ example: 'Peter T.' })
  @Expose()
  fullName: string;

  @ApiProperty({ example: 'peter@example.com' })
  @Expose()
  email: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/...', nullable: true })
  @Expose()
  profilePictureUrl: string;
}

// Current Status DTO
export class ReviewRequestStatusDto {
  @ApiProperty({ example: 'COMPLETED' })
  @Expose()
  status: string;
}

// Travel DTO for review response
export class ReviewTravelDto {
  @ApiProperty({ example: 18 })
  @Expose()
  id: number;

  @ApiProperty({ example: '2025-11-15T08:18:06.238Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2025-11-15T08:43:05.000Z' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  deletedAt: Date | null;

    @ApiProperty({ example: 38, nullable: true })
    @Expose()
    createdBy: number | null;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  updatedBy: number | null;

  @ApiProperty({ example: false })
  @Expose()
  isDeactivated: boolean;

  @ApiProperty({ example: 38 })
  @Expose()
  userId: number;

  @ApiProperty({ example: 'Je vais en voyage d\'affaires à Tokyo...' })
  @Expose()
  description: string;

  @ApiProperty({ example: 'BAF803' })
  @Expose()
  flightNumber: string;

  @ApiProperty({ example: false })
  @Expose()
  isSharedWeight: boolean;

  @ApiProperty({ example: true })
  @Expose()
  isInstant: boolean;

  @ApiProperty({ example: false })
  @Expose()
  isAllowExtraWeight: boolean;

  @ApiProperty({ example: false, description: 'Punctuality level (false = punctual, true = very punctual)' })
  @Expose()
  punctualityLevel: boolean;

  @ApiProperty({ example: '0.00' })
  @Expose()
  feeForGloomy: string;

  @ApiProperty({ example: 3, nullable: true })
  @Expose()
  airlineId: number | null;

  @ApiProperty({ example: 24132 })
  @Expose()
  departureAirportId: number;

  @ApiProperty({ example: 34643 })
  @Expose()
  arrivalAirportId: number;

  @ApiProperty({ example: '2025-11-21T19:00:00.000Z' })
  @Expose()
  departureDatetime: Date;

  @ApiProperty({ example: '6.00' })
  @Expose()
  totalWeightAllowance: string;

  @ApiProperty({ example: '0.00' })
  @Expose()
  weightAvailable: string;

  @ApiProperty({ example: '4.00' })
  @Expose()
  pricePerKg: string;

  @ApiProperty({ example: 1, nullable: true })
  @Expose()
  currencyId: number | null;

  @ApiProperty({ example: 'filled' })
  @Expose()
  status: string;
}

// Demand DTO for review response (can be null)
export class ReviewDemandDto {
  // Add all demand fields similar to travel if needed
  // For now, it can be null or empty object
  [key: string]: any;
}

// Request DTO for review response
export class ReviewRequestDto {
  @ApiProperty({ example: 12 })
  @Expose()
  id: number;

  @ApiProperty({ example: '2025-11-15T08:43:03.693Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2025-11-15T08:50:38.000Z' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  demandId: number | null;

  @ApiProperty({ example: 18, nullable: true })
  @Expose()
  travelId: number | null;

  @ApiProperty({ example: 43 })
  @Expose()
  requesterId: number;

  @ApiProperty({ example: 'GoAndGo' })
  @Expose()
  requestType: string;

  @ApiProperty({ example: '6.00' })
  @Expose()
  weight: string | null;

    @ApiProperty({ example: 4, nullable: true })
    @Expose()
    currentStatusId: number | null;

    @ApiProperty({ type: ReviewRequestStatusDto, nullable: true })
    @Expose()
    @Type(() => ReviewRequestStatusDto)
    currentStatus: ReviewRequestStatusDto | null;

    @ApiProperty({ type: ReviewTravelDto, nullable: true })
    @Expose()
    @Type(() => ReviewTravelDto)
    travel: ReviewTravelDto | null;

    @ApiProperty({ type: ReviewDemandDto, nullable: true })
    @Expose()
    @Type(() => ReviewDemandDto)
    demand: ReviewDemandDto | null;
}

// Clean review data for create response
export class CreateReviewDataDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiProperty({ example: 'Very friendly and professional...' })
  comment: string;

  @ApiProperty({ example: 10 })
  requestId: number;

  @ApiProperty({ example: 30 })
  reviewerId: number;

  @ApiProperty({ example: 29 })
  revieweeId: number;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: ReviewUserDto })
  reviewer: ReviewUserDto;

  @ApiProperty({ type: ReviewUserDto })
  reviewee: ReviewUserDto;
}

// Response for create review
export class CreateReviewResponseDto {
  @ApiProperty({ example: 'Review created successfully' })
  message: string;

  @ApiProperty({ type: CreateReviewDataDto })
  review: CreateReviewDataDto;
}

export class ReviewResponseDto {
    @ApiProperty({ example: 3 })
    @Expose()
    id: number;

    @ApiProperty({ example: '2025-11-15T08:52:39.433Z' })
    @Expose()
    createdAt: Date;

    @ApiProperty({ example: '2025-11-15T08:52:39.433Z' })
    @Expose()
    updatedAt: Date;

    @ApiProperty({ example: 43 })
    @Expose()
    reviewerId: number;

    @ApiProperty({ example: 38 })
    @Expose()
    revieweeId: number;

    @ApiProperty({ example: 12 })
    @Expose()
    requestId: number;

    @ApiProperty({ example: '4.7' })
    @Expose()
    rating: string | null;

    @ApiProperty({ example: 'Très ponctuel et courtois, je recommande!!', nullable: true })
    @Expose()
    comment: string | null;

    @ApiProperty({ type: ReviewRequestDto, nullable: true })
    @Expose()
    @Type(() => ReviewRequestDto)
    request: ReviewRequestDto | null;

    @ApiProperty({ type: ReviewUserDto, nullable: true })
    @Expose()
    @Type(() => ReviewUserDto)
    reviewer: ReviewUserDto | null;

    @ApiProperty({ type: ReviewUserDto, nullable: true })
    @Expose()
    @Type(() => ReviewUserDto)
    reviewee: ReviewUserDto | null;
  }
  
  export class PaginatedReviewsResponseDto {
    items: ReviewResponseDto[];
    meta: {
      currentPage: number;
      itemsPerPage: number;
      totalItems: number;
      totalPages: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  }