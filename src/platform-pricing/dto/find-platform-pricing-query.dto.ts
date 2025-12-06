import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class FindPlatformPricingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Lower bound of the price range in EUR', example: 1, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(0)
  @Type(() => Number)
  lowerBound?: number;

  @ApiPropertyOptional({ description: 'Upper bound of the price range in EUR', example: 6, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(0)
  @Type(() => Number)
  upperBound?: number;
}

