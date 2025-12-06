import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { SupportRequestResponseDto } from './support-request-response.dto';

export class PaginatedSupportRequestsResponseDto {
  @ApiProperty({ description: 'List of support requests', type: [SupportRequestResponseDto] })
  @Expose()
  @Type(() => SupportRequestResponseDto)
  data: SupportRequestResponseDto[];

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

