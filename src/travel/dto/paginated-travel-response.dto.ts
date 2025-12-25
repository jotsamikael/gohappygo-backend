import { ApiProperty } from "@nestjs/swagger";
import { TravelResponseDto } from "./travel-response.dto";

export class PaginatedTravelResponseDto {
  @ApiProperty({ type: [TravelResponseDto] })
  items: TravelResponseDto[];

  @ApiProperty({
    example: {
      currentPage: 1,
      itemsPerPage: 10,
      totalItems: 100,
      totalPages: 10,
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

