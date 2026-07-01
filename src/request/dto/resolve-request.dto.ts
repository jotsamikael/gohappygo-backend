import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveRequestDto {
  @ApiPropertyOptional({
    maxLength: 500,
    description:
      'Admin notes describing how the dispute was handled (e.g. manual Stripe refund/payout reference).',
    example: 'Refunded buyer via Stripe Dashboard payment pi_xxx; both parties notified by phone.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
