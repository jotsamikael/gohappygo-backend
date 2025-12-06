import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateBookmarkDto } from './create-bookmark.dto';

export class UpdateBookmarkDto extends PartialType(
  OmitType(CreateBookmarkDto, ['bookmarkType', 'travelId', 'demandId'] as const)
) {}
