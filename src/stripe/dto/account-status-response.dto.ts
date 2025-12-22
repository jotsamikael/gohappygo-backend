import { ApiProperty } from '@nestjs/swagger';

export class AccountStatusResponseDto {
  @ApiProperty({
    description: 'Stripe Connect account ID',
    example: 'acct_1234567890',
    nullable: true,
  })
  accountId: string | null;

  @ApiProperty({
    description: 'Account status',
    example: 'active',
    enum: ['uninitiated', 'pending', 'active', 'restricted'],
  })
  status: 'uninitiated' | 'pending' | 'active' | 'restricted';

  @ApiProperty({
    description: 'Whether the account can receive payments',
    example: true,
  })
  chargesEnabled: boolean;

  @ApiProperty({
    description: 'Whether the account can make transfers',
    example: true,
  })
  transfersEnabled: boolean;

  @ApiProperty({
    description: 'Whether account details are submitted',
    example: true,
  })
  detailsSubmitted: boolean;
}

