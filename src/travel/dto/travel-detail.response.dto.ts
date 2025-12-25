import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

// Airport DTO for travel detail (only required fields)
export class TravelDetailAirportDto {
    @ApiProperty({ example: 1568 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'Brazos Polo Airport' })
    @Expose()
    name: string;

    @ApiProperty({ example: 29.632117 })
    @Expose()
    latitudeDeg: number;

    @ApiProperty({ example: -95.932481 })
    @Expose()
    longitudeDeg: number;

    @ApiProperty({ example: 'NA' })
    @Expose()
    continent: string;

    @ApiProperty({ example: 'US' })
    @Expose()
    isoCountry: string;

    @ApiProperty({ example: '' })
    @Expose()
    icaoCode: string;

    @ApiProperty({ example: '' })
    @Expose()
    iataCode: string;

    @ApiProperty({ example: '2025-08-28T10:39:29.893Z' })
    @Expose()
    createdAt: Date;
}

// User DTO for travel detail (only required fields)
export class TravelDetailUserDto {
    @ApiProperty({ example: 38 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'patrickolongo@gmail.com' })
    @Expose()
    email: string;

    @ApiProperty({ example: 'Patrick' })
    @Expose()
    firstName: string;

    @ApiProperty({ example: 'OLONGO' })
    @Expose()
    lastName: string;

    @ApiProperty({ example: 'Patrick O.' })
    @Expose()
    fullName: string;

    @ApiProperty({ example: '+33611114754' })
    @Expose()
    phone: string;

    @ApiProperty({ example: null, nullable: true })
    @Expose()
    username: string | null;

    @ApiProperty({ example: 'https://res.cloudinary.com/...' })
    @Expose()
    profilePictureUrl: string;

    @ApiProperty({ example: "I'm Billionnaire Who love the travels" })
    @Expose()
    bio: string;

    @ApiProperty({ example: true })
    @Expose()
    isVerified: boolean;

    @ApiProperty({ example: '2025-10-09T19:07:14.516Z' })
    @Expose()
    createdAt: Date;

    @ApiProperty({ example: 4.75, nullable: true })
    @Expose()
    rating: number | null;

    @ApiProperty({ example: 15 })
    @Expose()
    numberOfReviews: number;
}

// Airline DTO for travel detail (only required fields)
export class TravelDetailAirlineDto {
    @ApiProperty({ example: 6 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'Bahamasair' })
    @Expose()
    name: string;

    @ApiProperty({ example: 'BHS' })
    @Expose()
    icaoCode: string;

    @ApiProperty({ example: 'UP' })
    @Expose()
    iataCode: string;

    @ApiProperty({ example: 'C6' })
    @Expose()
    prefix: string;

    @ApiProperty({ example: 'https://cdn.flightradar24.com/...' })
    @Expose()
    logoUrl: string;
}

// Image DTO for travel detail (only required fields)
export class TravelDetailImageDto {
    @ApiProperty({ example: 100 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'https://res.cloudinary.com/...' })
    @Expose()
    fileUrl: string;

    @ApiProperty({ example: 'betsmarter-logo.png' })
    @Expose()
    originalName: string;

    @ApiProperty({ example: '5' })
    @Expose()
    purpose: string;
}

// Reviewer DTO for travel detail review
export class TravelDetailReviewerDto {
    @ApiProperty({ example: 43 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'Joe' })
    @Expose()
    firstName: string;

    @ApiProperty({ example: 'OBAMA' })
    @Expose()
    lastName: string;

    @ApiProperty({ example: 'Joe O.' })
    @Expose()
    fullName: string;

    @ApiProperty({ example: 'assetsshore@gmail.com' })
    @Expose()
    email: string;

    @ApiProperty({ example: 'https://res.cloudinary.com/...' })
    @Expose()
    profilePictureUrl: string;
}

// Review DTO for travel detail (without reviewee since we already know who is being reviewed)
export class TravelDetailReviewDto {
    @ApiProperty({
        description: 'Review ID',
        example: 1
    })
    @Expose()
    id: number;

    @ApiProperty({
        description: 'Review created at',
        example: '2025-01-01T10:00:00Z'
    })
    @Expose()
    createdAt: Date;

    @ApiProperty({
        description: 'Review updated at',
        example: '2025-01-01T10:00:00Z'
    })
    @Expose()
    updatedAt: Date;

    @ApiProperty({
        description: 'Reviewer user ID',
        example: 1
    })
    @Expose()
    reviewerId: number;

    @ApiProperty({
        description: 'Reviewee user ID',
        example: 2
    })
    @Expose()
    revieweeId: number;

    @ApiProperty({
        description: 'Request ID',
        example: 1
    })
    @Expose()
    requestId: number;

    @ApiProperty({
        description: 'Review rating',
        example: '4.7'
    })
    @Expose()
    rating: string;

    @ApiProperty({
        description: 'Review comment',
        example: 'Très ponctuel et courtois, je recommande!!',
        nullable: true
    })
    @Expose()
    comment: string;

    @ApiProperty({
        description: 'Reviewer user information',
        type: TravelDetailReviewerDto
    })
    @Expose()
    @Type(() => TravelDetailReviewerDto)
    reviewer: TravelDetailReviewerDto;
}

// Currency DTO for travel detail
export class TravelDetailCurrencyDto {
    @ApiProperty({ example: 1 })
    @Expose()
    id: number;
    
    @ApiProperty({ example: 'USD' })
    @Expose()
    code: string;
    
    @ApiProperty({ example: '$' })
    @Expose()
    symbol: string;
}

export class TravelDetailResponseDto {
    @ApiProperty({ example: 16 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'Travel to New Delhi from Jerusalem with available space for packages' })
    @Expose()
    description: string;

    @ApiProperty({ example: 'UP9999' })
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

    @ApiProperty({ example: false, description: 'Punctuality level (false = punctual, true = very punctual)' })
    @Expose()
    punctualityLevel: boolean;

    @ApiProperty({ example: 5 })
    @Expose()
    feeForGloomy: number;

    @ApiProperty({ type: TravelDetailCurrencyDto, nullable: true })
    @Expose()
    @Type(() => TravelDetailCurrencyDto)
    currency: TravelDetailCurrencyDto | null;

    @ApiProperty({ type: TravelDetailAirportDto })
    @Expose()
    @Type(() => TravelDetailAirportDto)
    departureAirport: TravelDetailAirportDto;

    @ApiProperty({ type: TravelDetailAirportDto })
    @Expose()
    @Type(() => TravelDetailAirportDto)
    arrivalAirport: TravelDetailAirportDto;

    @ApiProperty({ example: '2025-11-21T10:00:00.000Z' })
    @Expose()
    departureDatetime: Date;

    @ApiProperty({ example: 12 })
    @Expose()
    totalWeightAllowance: number;

    @ApiProperty({ example: 12 })
    @Expose()
    weightAvailable: number;

    @ApiProperty({ example: 2.5 })
    @Expose()
    pricePerKg: number;

    @ApiProperty({ example: 'active' })
    @Expose()
    status: string;

    @ApiProperty({ type: TravelDetailUserDto })
    @Expose()
    @Type(() => TravelDetailUserDto)
    user: TravelDetailUserDto;

    @ApiProperty({ type: TravelDetailAirlineDto })
    @Expose()
    @Type(() => TravelDetailAirlineDto)
    airline: TravelDetailAirlineDto;

    @ApiProperty({ type: [TravelDetailImageDto] })
    @Expose()
    @Type(() => TravelDetailImageDto)
    images: TravelDetailImageDto[];

    @ApiProperty({ example: '2025-11-14T19:21:17.988Z' })
    @Expose()
    createdAt: Date;

    @ApiProperty({ type: [TravelDetailReviewDto] })
    @Expose()
    @Type(() => TravelDetailReviewDto)
    reviews: TravelDetailReviewDto[];

}