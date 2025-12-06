import { ApiProperty } from "@nestjs/swagger";
import { AirportResponseDto } from "src/airport/dto/airport-response.dto";
import { UserResponseDto } from "src/user/dto/user-response.dto";
import { PackageKind } from "../package-kind.enum";

export class DemandResponseDto {
    @ApiProperty({ example: 'Demand created successfully' })
    title: string;

 @ApiProperty({ example: 'BA123' })
    flightNumber: string;
  
  @ApiProperty({ example: 'I need to send a package from New York to London' })
    description: string;
  
  @ApiProperty({ example: 1 })
    departureAirportId: number;
  
  @ApiProperty({ example: 2 })
    arrivalAirportId: number;
  
  @ApiProperty({ example: '2025-01-01' })
    deliveryDate: Date;
  
  @ApiProperty({ example: 10 })
    weight: number;
  
  @ApiProperty({ example: 10 })
    pricePerKg: number;
    
  @ApiProperty({ example: 'FRAGILE', enum: PackageKind })
    packageKind: PackageKind;

    @ApiProperty({ example: 'active', enum: ['active', 'expired', 'cancelled', 'resolved'] })
  status: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: AirportResponseDto, required: false })
  originAirport?: AirportResponseDto;

  @ApiProperty({ type: AirportResponseDto, required: false })
  destinationAirport?: AirportResponseDto;

  @ApiProperty({ type: UserResponseDto, required: false })
  user?: UserResponseDto;
}

export class CreateDemandResponseDto {
    @ApiProperty({ example: 'Demand created successfully' })
    message: string;

    @ApiProperty({ example: DemandResponseDto })
    demand: DemandResponseDto;
}

export class UpdateDemandResponseDto {
    @ApiProperty({ example: 'Demand updated successfully' })
    message: string;
}

export class PaginatedDemandsResponseDto {
  @ApiProperty({ type: [DemandResponseDto] })
  data: DemandResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}