import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class FindThreadQueryDto extends PaginationQueryDto {

  @ApiPropertyOptional({
    description: 'Filter by message text',
    example: 'Hello',
    required: false,
  })
  @IsOptional()
  @IsString()
  messageText?: string;

  @ApiPropertyOptional({
    description: 'Sort order (field:direction)',
    example: 'createdAt:asc',
    enum: ['createdAt:asc', 'createdAt:desc', 'id:asc', 'id:desc'],
    required: false,
  })
  @IsOptional()
  @IsString()
  orderBy?: string;
}

