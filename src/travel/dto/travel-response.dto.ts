import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

// Airport DTO for travel list response
export class TravelListAirportDto {
  @ApiProperty({ example: 1987 })
  @Expose()
  id: number;

  @ApiProperty({ example: "0CT7" })
  @Expose()
  ident: string;

  @ApiProperty({ example: "heliport" })
  @Expose()
  type: string;

  @ApiProperty({ example: "Bridgeport Hospital Heliport" })
  @Expose()
  name: string;

  @ApiProperty({ example: "US" })
  @Expose()
  isoCountry: string;

  @ApiProperty({ example: "US-CT" })
  @Expose()
  isoRegion: string;

  @ApiProperty({ example: "Bridgeport" })
  @Expose()
  municipality: string;

  @ApiProperty({ example: "" })
  @Expose()
  icaoCode: string;

  @ApiProperty({ example: "" })
  @Expose()
  iataCode: string;
}

// User DTO for travel list response
export class TravelListUserDto {
  @ApiProperty({ example: 43 })
  @Expose()
  id: number;

  @ApiProperty({ example: "2025-11-09T12:04:35.233Z" })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: "2025-12-17T10:22:02.025Z" })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ example: false })
  @Expose()
  isDeactivated: boolean;

  @ApiProperty({ example: "assetsshore@gmail.com" })
  @Expose()
  email: string;

  @ApiProperty({ example: "Joe" })
  @Expose()
  firstName: string;

  @ApiProperty({ example: "Obama" })
  @Expose()
  lastName: string;

  @ApiProperty({ example: "I am a traveler who like exotic places" })
  @Expose()
  bio: string;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  fullName: string | null;

  @ApiProperty({ example: "https://res.cloudinary.com/dgdy4huuc/image/upload/v1765641665/gohappygo/zpp57h1elyt1ylel0cj0.png" })
  @Expose()
  profilePictureUrl: string;

  @ApiProperty({ example: true })
  @Expose()
  isVerified: boolean;

  @ApiProperty({ example: "4.40" })
  @Expose()
  rating: string;

  @ApiProperty({ example: 2 })
  @Expose()
  numberOfReviews: number;

  @ApiProperty({ example: "uninitiated" })
  @Expose()
  stripeAccountStatus: string;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  stripeCountryCode: string | null;
}

// Image DTO for travel list response
export class TravelListImageDto {
  @ApiProperty({ example: 102 })
  @Expose()
  id: number;

  @ApiProperty({ example: "images (1).jpg" })
  @Expose()
  originalName: string;

  @ApiProperty({ example: "https://res.cloudinary.com/dgdy4huuc/image/upload/v1763155356/gohappygo/vy9c6icu52o0iqftqos3.jpg" })
  @Expose()
  fileUrl: string;

  @ApiProperty({ example: 11396 })
  @Expose()
  size: number;

  @ApiProperty({ example: "image/jpeg" })
  @Expose()
  mimeType: string;

  @ApiProperty({ example: 6 })
  @Expose()
  purpose: number;

  @ApiProperty({ example: "2025-11-14T21:22:37.535Z" })
  @Expose()
  uploadedAt: Date;

  @ApiProperty({ example: 17 })
  @Expose()
  travelId: number;
}

// Airline DTO for travel list response
export class TravelListAirlineDto {
  @ApiProperty({ example: 70 })
  @Expose()
  id: number;

  @ApiProperty({ example: false })
  @Expose()
  isDeactivated: boolean;

  @ApiProperty({ example: "MPE" })
  @Expose()
  icaoCode: string;

  @ApiProperty({ example: "5T" })
  @Expose()
  iataCode: string;

  @ApiProperty({ example: "Canadian North" })
  @Expose()
  name: string;

  @ApiProperty({ example: "https://images.planefinder.net/api/logo-square/MPE/w/80" })
  @Expose()
  logoUrl: string;
}

// Main Travel Response DTO
export class TravelResponseDto {
  @ApiProperty({ example: 17 })
  @Expose()
  id: number;

  @ApiProperty({ example: "2025-11-14T21:22:34.763Z" })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: "2025-12-11T16:00:29.000Z" })
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

  @ApiProperty({ example: 43 })
  @Expose()
  userId: number;

  @ApiProperty({ example: "Travel to Toulouse with available space for packages" })
  @Expose()
  description: string;

  @ApiProperty({ example: "5T7401" })
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

  @ApiProperty({ example: false })
  @Expose()
  punctualityLevel: boolean;

  @ApiProperty({ example: "2.00" })
  @Expose()
  feeForGloomy: string;

  @ApiProperty({ example: "0.00" })
  @Expose()
  feeForLateComer: string;

  @ApiProperty({ example: 70 })
  @Expose()
  airlineId: number;

  @ApiProperty({ example: 1987 })
  @Expose()
  departureAirportId: number;

  @ApiProperty({ example: 1465 })
  @Expose()
  arrivalAirportId: number;

  @ApiProperty({ example: "2025-12-12T00:00:00.000Z" })
  @Expose()
  departureDatetime: Date;

  @ApiProperty({ example: "6.00" })
  @Expose()
  totalWeightAllowance: string;

  @ApiProperty({ example: "3.00" })
  @Expose()
  weightAvailable: string;

  @ApiProperty({ example: "3.00" })
  @Expose()
  pricePerKg: string;

  @ApiProperty({ example: 1 })
  @Expose()
  currencyId: number;

  @ApiProperty({ example: "active" })
  @Expose()
  status: string;

  @ApiProperty({ type: TravelListAirportDto })
  @Expose()
  @Type(() => TravelListAirportDto)
  departureAirport: TravelListAirportDto;

  @ApiProperty({ type: TravelListAirportDto })
  @Expose()
  @Type(() => TravelListAirportDto)
  arrivalAirport: TravelListAirportDto;

  @ApiProperty({ type: TravelListUserDto })
  @Expose()
  @Type(() => TravelListUserDto)
  user: TravelListUserDto;

  @ApiProperty({ type: [TravelListImageDto] })
  @Expose()
  @Type(() => TravelListImageDto)
  images: TravelListImageDto[];

  @ApiProperty({ type: TravelListAirlineDto })
  @Expose()
  @Type(() => TravelListAirlineDto)
  airline: TravelListAirlineDto;

  @ApiProperty({ example: false, description: 'Whether the travel is editable (true if no requests exist)' })
  @Expose()
  isEditable: boolean;
}

export class CreateTravelResponseDto {  
  @ApiProperty({ example: 'Travel created successfully' })
  message: string;
  @ApiProperty({ type: TravelResponseDto })
  travel: TravelResponseDto;
}
