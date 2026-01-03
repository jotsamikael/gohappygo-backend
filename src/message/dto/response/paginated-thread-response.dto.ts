import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { ThreadMessageResponseDto } from './thread-message-response.dto';

export class PaginatedThreadResponseDto implements PaginatedResponse<ThreadMessageResponseDto> {
  @ApiProperty({ type: [ThreadMessageResponseDto], description: 'Array of messages in the thread' })
  items: ThreadMessageResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      currentPage: 1,
      itemsPerPage: 10,
      totalItems: 25,
      totalPages: 3,
      hasPreviousPage: false,
      hasNextPage: true,
    },
  })
  meta: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

