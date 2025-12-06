import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class FindCurrenciesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by currency code' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Search by currency name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Search by country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ 
    description: 'Filter by active status',
    type: Boolean 
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ 
    description: 'Sort order', 
    enum: ['code:asc', 'code:desc', 'name:asc', 'name:desc', 'createdAt:asc', 'createdAt:desc'],
    default: 'code:asc'
  })
  @IsOptional()
  @IsString()
  orderBy?: string;
}
