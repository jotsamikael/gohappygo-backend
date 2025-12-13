import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

// Airport DTO for demand detail (only required fields)
export class DemandDetailAirportDto {
    @ApiProperty({ example: 25528 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'medium_airport' })
    @Expose()
    type: string;

    @ApiProperty({ example: 'Aalborg Airport' })
    @Expose()
    name: string;

    @ApiProperty({ example: '57.0947630' })
    @Expose()
    latitudeDeg: string;

    @ApiProperty({ example: '9.8499300' })
    @Expose()
    longitudeDeg: string;

    @ApiProperty({ example: 'EU' })
    @Expose()
    continent: string;

    @ApiProperty({ example: 'DK' })
    @Expose()
    isoCountry: string;

    @ApiProperty({ example: 'Aalborg' })
    @Expose()
    municipality: string;

    @ApiProperty({ example: 'EKYT' })
    @Expose()
    icaoCode: string;

    @ApiProperty({ example: 'AAL' })
    @Expose()
    iataCode: string;
}

// User DTO for demand detail (only required fields)
export class DemandDetailUserDto {
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

    @ApiProperty({ example: false })
    @Expose()
    isDeactivated: boolean;

    @ApiProperty({ example: false })
    @Expose()
    isPhoneVerified: boolean;

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

// Airline DTO for demand detail (only required fields)
export class DemandDetailAirlineDto {
    @ApiProperty({ example: 2008 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'Sweden - Swedish Maritime Administration' })
    @Expose()
    name: string;

    @ApiProperty({ example: 'HMF' })
    @Expose()
    icaoCode: string;

    @ApiProperty({ example: '' })
    @Expose()
    iataCode: string;

    @ApiProperty({ example: 'https://cdn.flightradar24.com/...' })
    @Expose()
    logoUrl: string;

    @ApiProperty({ example: false })
    @Expose()
    isDeactivated: boolean;

    @ApiProperty({ example: '2025-09-08T13:42:50.000Z' })
    @Expose()
    createdAt: Date;
}

// Image DTO for demand detail (only required fields)
export class DemandDetailImageDto {
    @ApiProperty({ example: 75 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'https://res.cloudinary.com/...' })
    @Expose()
    fileUrl: string;

    @ApiProperty({ example: 7 })
    @Expose()
    purpose: number;

    @ApiProperty({ example: '2025-10-24T20:46:11.342Z' })
    @Expose()
    uploadedAt: Date;

    @ApiProperty({ example: null, nullable: true })
    @Expose()
    travelId: number | null;

    @ApiProperty({ example: 11 })
    @Expose()
    demandId: number;
}

// Reviewer DTO for demand detail review
export class DemandDetailReviewerDto {
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

// Review DTO for demand detail (without reviewee since we already know who is being reviewed)
export class DemandDetailReviewDto {
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
        type: DemandDetailReviewerDto
    })
    @Expose()
    @Type(() => DemandDetailReviewerDto)
    reviewer: DemandDetailReviewerDto;
}

export class DemandDetailCurrencyDto {
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

export class DemandDetailResponseDto{
        @ApiProperty({ example: 11 })
        @Expose()
        id: number;
            
        @ApiProperty({ example: 'I wm travelling to France' })
        @Expose()
        description: string;
    
        @ApiProperty({ example: 'AF9148' })
        @Expose()
        flightNumber: string;    
    
        @ApiProperty({ type: DemandDetailAirportDto })
        @Expose()
        @Type(() => DemandDetailAirportDto)
        departureAirport: DemandDetailAirportDto;
    
        @ApiProperty({ type: DemandDetailAirportDto })
        @Expose()
        @Type(() => DemandDetailAirportDto)
        arrivalAirport: DemandDetailAirportDto;
    
        @ApiProperty({ example: '10.00' })
        @Expose()
        weight: string;
    
        @ApiProperty({ example: '10.00' })
        @Expose()
        pricePerKg: string;
    
        @ApiProperty({ example: 'active' })
        @Expose()
        status: string;


        @ApiProperty({ type: DemandDetailCurrencyDto, nullable: true })
        @Expose()
        @Type(() => DemandDetailCurrencyDto)
        currency: DemandDetailCurrencyDto | null;
    
        @ApiProperty({ type: DemandDetailUserDto })
        @Expose()
        @Type(() => DemandDetailUserDto)
        user: DemandDetailUserDto;
    
        @ApiProperty({ type: DemandDetailAirlineDto })
        @Expose()
        @Type(() => DemandDetailAirlineDto)
        airline: DemandDetailAirlineDto;
    
        @ApiProperty({ type: [DemandDetailImageDto] })
        @Expose()
        @Type(() => DemandDetailImageDto)
        images: DemandDetailImageDto[];
    
        @ApiProperty({ example: '2025-10-24T20:46:10.035Z' })
        @Expose()
        createdAt: Date;
    
        @ApiProperty({ type: [DemandDetailReviewDto] })
        @Expose()
        @Type(() => DemandDetailReviewDto)
        reviews: DemandDetailReviewDto[];
    
        @ApiProperty({ example: '2025-11-14T10:09:49.294Z' })
        @Expose()
        updatedAt: Date;

        @ApiProperty({ example: null, nullable: true })
        @Expose()
        deletedAt: Date | null;

        @ApiProperty({ example: 38 })
        @Expose()
        createdBy: number;

        @ApiProperty({ example: null, nullable: true })
        @Expose()
        updatedBy: number | null;

        @ApiProperty({ example: false })
        @Expose()
        isDeactivated: boolean;

        @ApiProperty({ example: 38 })
        @Expose()
        userId: number;

        @ApiProperty({ example: 2008, nullable: true })
        @Expose()
        airlineId: number | null;

        @ApiProperty({ example: 25528 })
        @Expose()
        departureAirportId: number;

        @ApiProperty({ example: 14006 })
        @Expose()
        arrivalAirportId: number;

        @ApiProperty({ example: '2025-10-29T23:00:00.000Z' })
        @Expose()
        travelDate: Date;

        @ApiProperty({ example: 1, nullable: true })
        @Expose()
        currencyId: number | null;

        @ApiProperty({ example: 'STANDARD' })
        @Expose()
        packageKind: string;

        @ApiProperty({ type: Array, example: [] })
        @Expose()
        requests: any[];
}