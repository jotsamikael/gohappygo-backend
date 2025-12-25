import { ApiProperty } from "@nestjs/swagger";
import { DemandResponseDto } from "./demand-response.dto";

export class PaginatedDemandResponseDto {
  @ApiProperty({ type: [DemandResponseDto] })
  items: DemandResponseDto[];

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

