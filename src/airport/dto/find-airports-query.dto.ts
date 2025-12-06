import { ApiProperty } from "@nestjs/swagger";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";
import { IsOptional, IsString, IsEnum, IsNumber } from "class-validator";

export class FindAirportsQueryDto extends PaginationQueryDto {
    @ApiProperty({
        description: 'The name of the airport',
        required: false,
        example: 'John F. Kennedy International Airport'
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({
        description: 'The municipality/city of the airport',
        required: false,
        example: 'New York'
    })
    @IsOptional()
    @IsString()
    municipality?: string;

    @ApiProperty({
        description: 'The country ISO code of the airport',
        required: false,
        example: 'US'
    })
    @IsOptional()
    @IsString()
    isoCountry?: string;
    
    @ApiProperty({
        description: 'The IATA code of the airport',
        required: false,
        example: 'JFK'
    })
    @IsOptional()
    @IsString()
    iataCode?: string;

    @ApiProperty({
        description: 'The ICAO code of the airport',
        required: false,
        example: 'KJFK'
    })
    @IsOptional()
    @IsString()
    icaoCode?: string;

    @ApiProperty({
        description: 'The continent of the airport',
        required: false,
        example: 'NA'
    })
    @IsOptional()
    @IsString()
    continent?: string;

    @ApiProperty({
        description: 'The region ISO code of the airport',
        required: false,
        example: 'US-NY'
    })
    @IsOptional()
    @IsString()
    isoRegion?: string;

    @ApiProperty({
        description: 'The type of airport',
        required: false,
        example: 'large_airport'
    })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({
        description: 'Filter by scheduled service status',
        required: false,
        example: 'yes',
        enum: ['yes', 'no']
    })
    @IsOptional()
    @IsEnum(['yes', 'no'])
    scheduledService?: 'yes' | 'no';

    @ApiProperty({
        description: 'The order by',
        required: false,
        example: 'name:asc',
        enum: ['name:asc', 'name:desc', 'municipality:asc', 'municipality:desc', 'isoCountry:asc', 'isoCountry:desc', 'iataCode:asc', 'iataCode:desc', 'icaoCode:asc', 'icaoCode:desc', 'continent:asc', 'continent:desc', 'createdAt:asc', 'createdAt:desc']
    })
    @IsOptional()
    @IsString()
    orderBy?: string;

    @ApiProperty({ description: 'Minimum latitude for viewport filtering', required: false })
    @IsOptional() @IsNumber() latitudeMin?: number;
    
    @ApiProperty({ description: 'Maximum latitude for viewport filtering', required: false })
    @IsOptional() @IsNumber() latitudeMax?: number;
    
    @ApiProperty({ description: 'Minimum longitude for viewport filtering', required: false })
    @IsOptional() @IsNumber() longitudeMin?: number;
    
    @ApiProperty({ description: 'Maximum longitude for viewport filtering', required: false })
    @IsOptional() @IsNumber() longitudeMax?: number;
}