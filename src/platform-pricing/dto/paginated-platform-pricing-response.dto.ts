import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PlatformPricingResponseDto } from './platform-pricing-response.dto';

export class PaginatedPlatformPricingResponseDto {
  @ApiProperty({ description: 'List of platform pricing records', type: [PlatformPricingResponseDto] })
  @Expose()
  @Type(() => PlatformPricingResponseDto)
  data: PlatformPricingResponseDto[];

  @ApiProperty({ description: 'Current page number' })
  @Expose()
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  @Expose()
  limit: number;

  @ApiProperty({ description: 'Total number of items' })
  @Expose()
  total: number;

  @ApiProperty({ description: 'Total number of pages' })
  @Expose()
  totalPages: number;
}

