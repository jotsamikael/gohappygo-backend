import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RequestPayoutDto {
  @ApiProperty({
    description: 'Amount to withdraw in USD',
    example: 100.50,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({
    description: 'Optional description for the payout',
    example: 'Monthly withdrawal',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
