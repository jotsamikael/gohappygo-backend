import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum SettleRequestAction {
  CANCEL_AND_REFUND = 'CANCEL_AND_REFUND',
  COMPLETE_AND_RELEASE_FUNDS = 'COMPLETE_AND_RELEASE_FUNDS',
}

export class SettleRequestDto {
  @ApiProperty({
    enum: SettleRequestAction,
    description: 'Action to take: CANCEL_AND_REFUND cancels the request and refunds the buyer; COMPLETE_AND_RELEASE_FUNDS completes the request and releases funds to the traveler.',
    example: SettleRequestAction.COMPLETE_AND_RELEASE_FUNDS,
  })
  @IsEnum(SettleRequestAction)
  action: SettleRequestAction;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Optional note explaining the reason for this settlement action.',
    example: 'Proof deadline missed, releasing funds to traveler.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
