import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsISO8601, IsNumber, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class FindAirlinesQueryDto extends PaginationQueryDto {
 
  @ApiPropertyOptional({ description: 'Search by airline name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Search by IATA code' })
  @IsOptional()
  @IsString()
  iataCode?: string;

  @ApiPropertyOptional({ description: 'Search by ICAO code' })
  @IsOptional()
  @IsString()
  icaoCode?: string;

  @ApiPropertyOptional({ description: 'Search by callsign' })
  @IsOptional()
  @IsString()
  callsign?: string;

  @ApiPropertyOptional({ 
    description: 'Sort order', 
    enum: ['name:asc', 'name:desc', 'iataCode:asc', 'iataCode:desc', 'icaoCode:asc', 'icaoCode:desc', 'createdAt:asc', 'createdAt:desc'],
    default: 'name:asc'
  })
  @IsOptional()
  @IsString()
  orderBy?: string;
}