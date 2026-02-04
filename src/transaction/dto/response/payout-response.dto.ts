import { ApiProperty } from '@nestjs/swagger';

export class PayoutResponseDto {
  @ApiProperty({
    description: 'Stripe Payout ID',
    example: 'po_1234567890',
  })
  payoutId: string;

  @ApiProperty({
    description: 'Payout amount',
    example: 100.50,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'usd',
  })
  currency: string;

  @ApiProperty({
    description: 'Payout status',
    example: 'pending',
    enum: ['pending', 'paid', 'failed', 'canceled'],
  })
  status: string;
}
