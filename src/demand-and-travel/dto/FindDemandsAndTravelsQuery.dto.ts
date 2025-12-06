import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, IsEnum, IsInt, IsNumber, Min, Max, IsISO8601, IsPositive } from "class-validator";
import { Type, Transform } from "class-transformer";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class FindDemandsAndTravelsQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Filter by title (searches both demands and travels)',
    example: 'Package delivery from New York',
    minLength: 2,
    maxLength: 500,
    required: false
  })
  @IsOptional()
  @IsString({message:'Title must be a string'})
  @MaxLength(500,{message:'Title search can\'t be more than 500 characters'})
  description?: string;

  @ApiProperty({
    description: 'Filter by flight number (searches both demands and travels)',
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
    description: 'Filter by origin airport ID (searches both demands and travels)',
    example: 1,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departureAirportId?: number;

  @ApiProperty({
    description: 'Filter by destination airport ID (searches both demands and travels)',
    example: 2,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  arrivalAirportId?: number;

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
    description: 'Filter by status (searches both demands and travels)',
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
    description: 'Filter by type (demand or travel)',
    enum: ['demand', 'travel'],
    required: false
  })
  @IsOptional()
  @IsEnum(['demand', 'travel'])
  type?: string;

  @ApiProperty({
    description: 'Filter by minimum weight',
    example: 2.5,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minWeight?: number;

  @ApiProperty({
    description: 'Filter by maximum weight',
    example: 10.0,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxWeight?: number;

  @ApiProperty({
    description: 'Filter by minimum price per kg',
    example: 5.0,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPricePerKg?: number;

  @ApiProperty({
    description: 'Filter by maximum price per kg',
    example: 25.0,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPricePerKg?: number;

  @ApiProperty({
    description: 'Filter by weight available (travels only)',
    example: 3,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  weightAvailable?: number;

  @ApiProperty({
    description: 'Filter by user verification status',
    example: true,
    required: false,
    type: Boolean
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isVerified?: boolean;

  @ApiProperty({
    description: 'Sort order (field:direction)',
    example: 'createdAt:desc',
    enum: ['createdAt:asc', 'createdAt:desc', 'travelDate:asc', 'travelDate:desc', 'description:asc', 'description:desc', 'flightNumber:asc', 'flightNumber:desc', 'pricePerKg:asc', 'pricePerKg:desc', 'weight:asc', 'weight:desc'],
    required: false
  })
  @IsOptional()
  @IsString()
  orderBy?: string;
}