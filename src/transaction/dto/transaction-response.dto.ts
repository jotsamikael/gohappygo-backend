import { ApiProperty } from "@nestjs/swagger";

export class TransactionResponseDto{

    @ApiProperty({ example: 1 })
    payerId: number;

    @ApiProperty({ example: 1 })
    payeeId: number;

    @ApiProperty({ example: 1 })
    requestId: number;
  
    @ApiProperty({ example: 10000 })
    amount: number;

    @ApiProperty({ example: 'pending' })
    status: string;

    @ApiProperty({ example: 'stripe' })
    paymentMethod: string;
}