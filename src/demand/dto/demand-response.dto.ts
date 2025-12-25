import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { PackageKind } from "../package-kind.enum";

// Airport DTO for demand list response
export class DemandListAirportDto {
  @ApiProperty({ example: 41401 })
  @Expose()
  id: number;

  @ApiProperty({ example: "KONT" })
  @Expose()
  ident: string;

  @ApiProperty({ example: "large_airport" })
  @Expose()
  type: string;

  @ApiProperty({ example: "Ontario International Airport" })
  @Expose()
  name: string;

  @ApiProperty({ example: "US" })
  @Expose()
  isoCountry: string;

  @ApiProperty({ example: "US-CA" })
  @Expose()
  isoRegion: string;

  @ApiProperty({ example: "Ontario" })
  @Expose()
  municipality: string;

  @ApiProperty({ example: "KONT" })
  @Expose()
  icaoCode: string;

  @ApiProperty({ example: "ONT" })
  @Expose()
  iataCode: string;
}

// User DTO for demand list response
export class DemandListUserDto {
  @ApiProperty({ example: 29 })
  @Expose()
  id: number;

  @ApiProperty({ example: "2025-09-13T19:44:29.010Z" })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: "2025-12-13T19:15:01.000Z" })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ example: false })
  @Expose()
  isDeactivated: boolean;

  @ApiProperty({ example: "jotsamikael0@gmail.com" })
  @Expose()
  email: string;

  @ApiProperty({ example: "James" })
  @Expose()
  firstName: string;

  @ApiProperty({ example: "Deanili" })
  @Expose()
  lastName: string;

  @ApiProperty({ example: "I am a traveler who like exotic places" })
  @Expose()
  bio: string;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  fullName: string | null;

  @ApiProperty({ example: "https://res.cloudinary.com/dgdy4huuc/image/upload/v1765651873/gohappygo/ecuacdwgrjdvewflyczo.jpg" })
  @Expose()
  profilePictureUrl: string;

  @ApiProperty({ example: true })
  @Expose()
  isVerified: boolean;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  rating: string | null;

  @ApiProperty({ example: 0 })
  @Expose()
  numberOfReviews: number;

  @ApiProperty({ example: "uninitiated" })
  @Expose()
  stripeAccountStatus: string;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  stripeCountryCode: string | null;
}

// Image DTO for demand list response
export class DemandListImageDto {
  @ApiProperty({ example: 130 })
  @Expose()
  id: number;

  @ApiProperty({ example: "WhatsApp-Image-2024-07-18-at-10.51.20-PM-1.webp" })
  @Expose()
  originalName: string;

  @ApiProperty({ example: "https://res.cloudinary.com/dgdy4huuc/image/upload/v1764399911/gohappygo/eafxnlj9nsez14m4n51p.webp" })
  @Expose()
  fileUrl: string;

  @ApiProperty({ example: 352528 })
  @Expose()
  size: number;

  @ApiProperty({ example: "gohappygo/eafxnlj9nsez14m4n51p" })
  @Expose()
  publicId: string;

  @ApiProperty({ example: "image/webp" })
  @Expose()
  mimeType: string;

  @ApiProperty({ example: 8 })
  @Expose()
  purpose: number;

  @ApiProperty({ example: "2025-11-29T07:05:12.131Z" })
  @Expose()
  uploadedAt: Date;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  travelId: number | null;

  @ApiProperty({ example: 19 })
  @Expose()
  demandId: number;
}

// Airline DTO for demand list response
export class DemandListAirlineDto {
  @ApiProperty({ example: 782 })
  @Expose()
  id: number;

  @ApiProperty({ example: false })
  @Expose()
  isDeactivated: boolean;

  @ApiProperty({ example: "SZN" })
  @Expose()
  icaoCode: string;

  @ApiProperty({ example: "HC" })
  @Expose()
  iataCode: string;

  @ApiProperty({ example: "Air Senegal" })
  @Expose()
  name: string;

  @ApiProperty({ example: "https://images.planefinder.net/api/logo-square/SZN/w/80" })
  @Expose()
  logoUrl: string;
}

// Main Demand Response DTO
export class DemandResponseDto {
  @ApiProperty({ example: 19 })
  @Expose()
  id: number;

  @ApiProperty({ example: "2025-11-29T07:05:04.655Z" })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: "2025-11-29T07:05:04.655Z" })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  deletedAt: Date | null;

  @ApiProperty({ example: 29 })
  @Expose()
  createdBy: number;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  updatedBy: number | null;

  @ApiProperty({ example: false })
  @Expose()
  isDeactivated: boolean;

  @ApiProperty({ example: 29 })
  @Expose()
  userId: number;

  @ApiProperty({ example: 104 })
  @Expose()
  airlineId: number;

  @ApiProperty({ example: "Hello dear happy travelers, I am travel from danemark to Nigeria for a mariage cermony and need 3.5 extra kilos for my gitt" })
  @Expose()
  description: string;

  @ApiProperty({ example: "DX6032" })
  @Expose()
  flightNumber: string;

  @ApiProperty({ example: 25499 })
  @Expose()
  departureAirportId: number;

  @ApiProperty({ example: 23974 })
  @Expose()
  arrivalAirportId: number;

  @ApiProperty({ example: "2025-12-12T23:00:00.000Z" })
  @Expose()
  travelDate: Date;

  @ApiProperty({ example: "3.50" })
  @Expose()
  weight: string;

  @ApiProperty({ example: "2.00" })
  @Expose()
  pricePerKg: string;

  @ApiProperty({ example: 1 })
  @Expose()
  currencyId: number;

  @ApiProperty({ example: "active" })
  @Expose()
  status: string;

  @ApiProperty({ example: "FRAGILE", enum: PackageKind })
  @Expose()
  packageKind: PackageKind;

  @ApiProperty({ type: DemandListAirportDto })
  @Expose()
  @Type(() => DemandListAirportDto)
  departureAirport: DemandListAirportDto;

  @ApiProperty({ type: DemandListAirportDto })
  @Expose()
  @Type(() => DemandListAirportDto)
  arrivalAirport: DemandListAirportDto;

  @ApiProperty({ type: DemandListUserDto })
  @Expose()
  @Type(() => DemandListUserDto)
  user: DemandListUserDto;

  @ApiProperty({ type: [DemandListImageDto] })
  @Expose()
  @Type(() => DemandListImageDto)
  images: DemandListImageDto[];

  @ApiProperty({ type: DemandListAirlineDto })
  @Expose()
  @Type(() => DemandListAirlineDto)
  airline: DemandListAirlineDto;
}

export class CreateDemandResponseDto {
  @ApiProperty({ example: 'Demand created successfully' })
  message: string;

  @ApiProperty({ type: DemandResponseDto })
  demand: DemandResponseDto;
}

export class UpdateDemandResponseDto {
  @ApiProperty({ example: 'Demand updated successfully' })
  message: string;
}
