import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { BookmarkType } from '../entities/bookmark.entity';

export class FindBookmarksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by bookmark type',
    enum: BookmarkType,
  })
  @IsOptional()
  @IsEnum(BookmarkType)
  bookmarkType?: BookmarkType;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['createdAt:asc', 'createdAt:desc'],
    default: 'createdAt:desc',
  })
  @IsOptional()
  @IsString()
  orderBy?: string;
}
