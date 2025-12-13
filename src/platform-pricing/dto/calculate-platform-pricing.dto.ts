import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, Min } from 'class-validator';

export class CalculatePlatformPricingDto {
  @ApiProperty({
    description: 'Number of kilos',
    example: 5.5,
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  kilos: number;

  @ApiProperty({
    description: 'Travel ID',
    example: 1,
  })
  @IsNumber()
  @IsPositive()
  travelId: number;
}

