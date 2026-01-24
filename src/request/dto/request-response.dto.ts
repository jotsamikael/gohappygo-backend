import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { RequestEntity } from '../request.entity';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: 'User first name', example: 'John' })
  @Expose()
  firstName: string;

  @ApiProperty({ description: 'User last name', example: 'Doe' })
  @Expose()
  lastName: string;

  @ApiProperty({ description: 'Full name formatted as "Firstname L."', example: 'John D.' })
  @Expose()
  fullName: string;

  @ApiProperty({ description: 'User email', example: 'john.doe@example.com' })
  @Expose()
  email: string;

  @ApiProperty({ description: 'Profile picture URL', example: 'https://example.com/profile.jpg', required: false })
  @Expose()
  profilePictureUrl?: string | null;
}

export class RequestAirlineResponseDto {
  @ApiProperty({ description: 'Airline ID', example: 1 })
  airlineId: number;

  @ApiProperty({ description: 'Airline name', example: 'British Airways' })
  name: string;

  @ApiProperty({ description: 'Airline logo URL', example: 'https://example.com/logo.png', required: false })
  logoUrl?: string | null;
}



export class StatusResponseDto {
  @ApiProperty({ description: 'Request status', example: 'NEGOTIATING' })
  status: string;
}

export class CurrencyResponseDto {
  @ApiProperty({ description: 'Currency code', example: 'EUR' })
  @Expose()
  code: string;

  @ApiProperty({ description: 'Currency name', example: 'EURO' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'Currency symbol', example: '€' })
  @Expose()
  symbol: string;
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
  travel?: any; // Travel object with airline information

  @ApiProperty({ description: 'Associated demand (if applicable)', required: false })
  demand?: any;

  @ApiProperty({ 
    description: 'Currency used in the travel/demand', 
    type: CurrencyResponseDto, 
    required: false 
  })
  currency?: CurrencyResponseDto | null;

  @ApiProperty({ description: 'Number of unread messages for this request', example: 2 })
  unReadMessages: number;

  @ApiProperty({ 
    description: 'Whether the connected user can review this request. True if request is COMPLETED and user has not yet reviewed it', 
    example: true 
  })
  canReview: boolean;
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
