import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, IsEnum, IsInt, Min, Max, IsISO8601 } from "class-validator";
import { Type } from "class-transformer";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";
import { PackageKind } from "../package-kind.enum";

export class FindDemandsQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Filter demands by title (optional)',
    example: 'Package delivery from New York',
    minLength: 2,
    maxLength: 500,
    required: false
  })
  @IsOptional()
  @IsString({message:'Description must be a string'})
  @MaxLength(500,{message:'description search can\'t be more than 500 characters'})
  description?: string;

  @ApiProperty({
    description: 'Filter by flight number',
    example: 'BA123',
    required: false
  })
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiProperty({
    description: 'Filter by airline ID',
    example: 1,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  airlineId?: number;

  @ApiProperty({
    description: 'Filter by origin airport ID',
    example: 1,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departureAirportId?: number;

  @ApiProperty({
    description: 'Filter by destination airport ID',
    example: 2,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  arrivalAirportId?: number;

  @ApiProperty({
    description: 'Filter by package kind',
    example: 'FRAGILE',
    enum: PackageKind,
    required: false
  })
  @IsOptional()
  @IsEnum(PackageKind)
  packageKind?: PackageKind;

  @ApiProperty({
    description: 'Filter by user ID (admin only)',
    example: 1,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiProperty({
    description: 'Filter by status',
    enum: ['active', 'expired', 'cancelled', 'resolved'],
    required: false
  })
  @IsOptional()
  @IsEnum(['active', 'expired', 'cancelled', 'resolved'])
  status?: string;

  @ApiProperty({
    description: 'Filter by delivery date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
    required: false
  })
  @IsOptional()
  @IsISO8601()
  travelDate?: string;

  @ApiProperty({
    description: 'Sort order (field:direction)',
    example: 'createdAt:desc',
    enum: ['createdAt:asc', 'createdAt:desc', 'deliveryDate:asc', 'deliveryDate:desc', 'pricePerKg:asc', 'pricePerKg:desc'],
    required: false
  })
  @IsOptional()
  @IsString()
  orderBy?: string;
}