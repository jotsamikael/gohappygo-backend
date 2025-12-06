import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class PlatformPricingResponseDto {
  @ApiProperty({ description: 'Pricing record ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Lower bound of the price range in EUR' })
  @Expose()
  lowerBound: number;

  @ApiProperty({ description: 'Upper bound of the price range in EUR' })
  @Expose()
  upperBound: number;

  @ApiProperty({ description: 'Platform fee in EUR' })
  @Expose()
  fee: number;

  @ApiProperty({ description: 'Creation timestamp' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @Expose()
  updatedAt: Date;
}

