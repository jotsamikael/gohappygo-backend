import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlatformPricingDto {
  @ApiProperty({
    description: 'Lower bound of the price range in EUR',
    example: 1,
    minimum: 0,
  })
  @IsNumber()
  @IsPositive()
  @Min(0)
  @Max(150)
  @Type(() => Number)
  lowerBound: number;

  @ApiProperty({
    description: 'Upper bound of the price range in EUR',
    example: 6,
    minimum: 0,
  })
  @IsNumber()
  @IsPositive()
  @Min(0)
  @Max(150)
  @Type(() => Number)
  upperBound: number;

  @ApiProperty({
    description: 'Platform fee in EUR (not percentage)',
    example: 2,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fee: number;
}
