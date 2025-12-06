import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, MaxLength, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class FindTravelsQueryDto extends PaginationQueryDto{
    @ApiProperty({
        description: 'Description of the travel',
        example: 'Travel to London',
        minLength: 2,
        maxLength: 500,
        required: false
      })
    @IsOptional()
    @IsString({message:'Description must be a string'})
    @MaxLength(500,{message:'Description search can\'t be more than 500 characters'})
    description?:string;

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
      description: 'Filter by departure airport ID',
      example: 1,
      required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    departureAirportId?: number;
  
    @ApiProperty({
      description: 'Filter by arrival airport ID',
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
      description: 'Filter by weight Available in kg',
      example: 3,
      required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    weightAvailable?:number;

    @ApiProperty({
      description: 'Filter by shared weight option',
      example: true,
      required: false
    })
    @IsOptional()
    @Transform(({ value }) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    })
    @IsBoolean()
    isSharedWeight?: boolean;

    @ApiProperty({
      description: 'Filter by instant travel option',
      example: false,
      required: false
    })
    @IsOptional()
    @Transform(({ value }) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    })
    @IsBoolean()
    isInstant?: boolean;

    @ApiProperty({
      description: 'Filter by allow extra weight option',
      example: true,
      required: false
    })
    @IsOptional()
    @Transform(({ value }) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    })
    @IsBoolean()
    isAllowExtraWeight?: boolean;
  
    @ApiProperty({
      description: 'Filter by status',
      enum: ['active', 'filled', 'cancelled'],
      required: false
    })
    @IsOptional()
    @IsEnum(['active', 'filled', 'cancelled'])
    status?: string;
  
    @ApiProperty({
      description: 'Filter by departure date (ISO 8601)',
      example: '2024-01-01T00:00:00Z',
      required: false
    })
    @IsOptional()
    @IsISO8601()
    departureDate?: string;
  
    @ApiProperty({
      description: 'Sort order (field:direction)',
      example: 'createdAt:desc',
      enum: ['createdAt:asc', 'createdAt:desc', 'departureDatetime:asc', 'departureDatetime:desc', 'pricePerKg:asc', 'pricePerKg:desc', 'weightAvailable:asc', 'weightAvailable:desc'],
      required: false
    })
    @IsOptional()
    @IsString()
    orderBy?: string;
}