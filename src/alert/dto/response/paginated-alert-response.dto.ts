import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { AlertResponseDto } from './alert-response.dto';

export class PaginatedAlertResponseDto implements PaginatedResponse<AlertResponseDto> {
  @ApiProperty({ type: [AlertResponseDto], description: 'Array of alerts' })
  items: AlertResponseDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  meta: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
