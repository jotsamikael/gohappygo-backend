import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { AlertType } from '../../entities/alert.entity';

export class FindAlertQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ 
    description: 'Filter by alert type', 
    enum: AlertType 
  })
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;

  @ApiPropertyOptional({ description: 'Filter by flight number' })
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiPropertyOptional({ description: 'Filter by departure airport ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departureAirportId?: number;

  @ApiPropertyOptional({ description: 'Filter by arrival airport ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  arrivalAirportId?: number;

  @ApiPropertyOptional({ description: 'Filter by travel date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  travelDate?: string;

  @ApiPropertyOptional({ 
    description: 'Sort order (field:direction)',
    example: 'createdAt:desc',
    enum: ['createdAt:asc', 'createdAt:desc', 'travelDate:asc', 'travelDate:desc'],
    required: false
  })
  @IsOptional()
  @IsString()
  orderBy?: string;
}
