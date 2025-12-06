import { ApiProperty } from '@nestjs/swagger';
import { RequestEntity } from '../request.entity';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'User first name', example: 'John' })
  firstName: string;

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  lastName: string;

  @ApiProperty({ description: 'Full name', example: 'John D.' })
  fullName: string;

  @ApiProperty({ description: 'User email', example: 'john.doe@example.com' })
  email: string;
}



export class StatusResponseDto {
  @ApiProperty({ description: 'Request status', example: 'NEGOTIATING' })
  status: string;
}

export class RequestResponseDto {
  @ApiProperty({ description: 'Request ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Creation date', example: '2025-01-01T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date', example: '2025-01-01T10:00:00Z' })
  updatedAt: Date;

  @ApiProperty({ description: 'Demand ID (if applicable)', example: 1, required: false })
  demandId: number | null;

  @ApiProperty({ description: 'Travel ID (if applicable)', example: 1, required: false })
  travelId: number | null;

  @ApiProperty({ description: 'Requester user ID', example: 1 })
  requesterId: number;

  @ApiProperty({ description: 'Request type', enum: ['GoAndGive', 'GoAndGo'], example: 'GoAndGo' })
  requestType: string;
  

  @ApiProperty({ description: 'Package weight', example: 5.5 })
  weight: number | null;



  @ApiProperty({ description: 'Current status ID', example: 2 })
  currentStatusId: number;

  @ApiProperty({ description: 'Requester user information', type: UserResponseDto })
  requester: UserResponseDto;

  @ApiProperty({ description: 'Current status', type: StatusResponseDto })
  currentStatus: StatusResponseDto;

  @ApiProperty({ description: 'Associated travel (if applicable)', required: false })
  travel?: any;

  @ApiProperty({ description: 'Associated demand (if applicable)', required: false })
  demand?: any;
}

export class PaginatedRequestsResponseDto {
  @ApiProperty({ description: 'List of requests', type: [RequestResponseDto] })
  items: RequestResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      currentPage: 1,
      itemsPerPage: 10,
      totalItems: 25,
      totalPages: 3,
      hasPreviousPage: false,
      hasNextPage: true
    }
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

export class CreateRequestResponseDto extends RequestResponseDto {}
