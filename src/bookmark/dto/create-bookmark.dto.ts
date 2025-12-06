import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { BookmarkType } from '../entities/bookmark.entity';

export class CreateBookmarkDto {
  @ApiProperty({
    description: 'Type of bookmark (TRAVEL or DEMAND)',
    enum: BookmarkType,
    example: BookmarkType.TRAVEL,
  })
  @IsEnum(BookmarkType)
  @IsNotEmpty()
  bookmarkType: BookmarkType;

  @ApiPropertyOptional({
    description: 'ID of the travel to bookmark (required if bookmarkType is TRAVEL)',
    example: 1,
  })
  @ValidateIf((o) => o.bookmarkType === BookmarkType.TRAVEL)
  @IsNumber()
  @IsNotEmpty()
  travelId?: number;

  @ApiPropertyOptional({
    description: 'ID of the demand to bookmark (required if bookmarkType is DEMAND)',
    example: 1,
  })
  @ValidateIf((o) => o.bookmarkType === BookmarkType.DEMAND)
  @IsNumber()
  @IsNotEmpty()
  demandId?: number;

  @ApiPropertyOptional({
    description: 'Optional notes about this bookmark',
    example: 'Good price and convenient timing',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
