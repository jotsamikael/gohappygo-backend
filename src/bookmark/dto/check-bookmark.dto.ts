import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, ValidateIf } from 'class-validator';
import { BookmarkType } from '../entities/bookmark.entity';

export class CheckBookmarkDto {
  @ApiProperty({
    description: 'Type of bookmark to check',
    enum: BookmarkType,
  })
  @IsEnum(BookmarkType)
  @IsNotEmpty()
  bookmarkType: BookmarkType;

  @ApiProperty({
    description: 'ID of the travel (if checking travel bookmark)',
    required: false,
  })
  @ValidateIf((o) => o.bookmarkType === BookmarkType.TRAVEL)
  @IsNumber()
  @IsNotEmpty()
  travelId?: number;

  @ApiProperty({
    description: 'ID of the demand (if checking demand bookmark)',
    required: false,
  })
  @ValidateIf((o) => o.bookmarkType === BookmarkType.DEMAND)
  @IsNumber()
  @IsNotEmpty()
  demandId?: number;
}
