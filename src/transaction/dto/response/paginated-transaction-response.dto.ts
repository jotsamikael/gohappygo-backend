import { ApiProperty } from "@nestjs/swagger";
import { PaginationMetaFormat } from "src/common/interfaces/paginated-reponse.interfaces";
import { TransactionResponseDto } from "../transaction-response.dto";

export class PaginatedTransactionResponseDto {
    @ApiProperty({ type: [TransactionResponseDto] })
    items: TransactionResponseDto[];

    @ApiProperty({ type: Object })
    meta: PaginationMetaFormat;
}

