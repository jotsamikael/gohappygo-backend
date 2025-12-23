import { ApiProperty } from "@nestjs/swagger";

export class TransactionResponseDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 1 })
    payerId: number;

    @ApiProperty({ example: 1 })
    payeeId: number;

    @ApiProperty({ example: 1 })
    requestId: number;
  
    @ApiProperty({ example: 100.50 })
    amount: number;

    @ApiProperty({ example: 100.50, nullable: true })
    originalAmount: number | null;

    @ApiProperty({ example: 87.39, nullable: true })
    convertedAmount: number | null;

    @ApiProperty({ example: 80.00, nullable: true, description: 'The amount the traveler should receive (before fees and TVA)' })
    travelerPayment: number | null;

    @ApiProperty({ example: 'pending', enum: ['pending', 'paid', 'awaiting_transfer', 'refunded', 'cancelled'] })
    status: string;

    @ApiProperty({ example: 'stripe' })
    paymentMethod: string;

    @ApiProperty({ example: 'EUR' })
    currencyCode: string;

    @ApiProperty({ example: 'pi_1234567890', nullable: true })
    stripePaymentIntentId: string | null;

    @ApiProperty({ example: 'tr_1234567890', nullable: true })
    stripeTransferId: string | null;

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    createdAt: Date;

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    updatedAt: Date;

    @ApiProperty({ nullable: true })
    payer: {
        id: number;
        email: string;
        firstName: string;
        lastName: string;
    } | null;

    @ApiProperty({ nullable: true })
    payee: {
        id: number;
        email: string;
        firstName: string;
        lastName: string;
    } | null;

    @ApiProperty({ nullable: true })
    request: {
        id: number;
        requestType: string;
        weight: number | null;
    } | null;
}
