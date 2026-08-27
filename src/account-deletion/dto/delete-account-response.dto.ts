import { ApiProperty } from '@nestjs/swagger';
import {
  DATA_CATEGORIES_REMOVED,
  DATA_CATEGORIES_RETAINED,
  DataCategoryRemoved,
  DataCategoryRetained,
} from '../account-deletion.types';

export class DeleteAccountResponseDto {
  @ApiProperty({ example: 'Account deleted and personal data anonymized successfully' })
  message: string;

  @ApiProperty({ example: '2026-08-27T12:00:00.000Z' })
  deletedAt: Date;

  @ApiProperty({ enum: DATA_CATEGORIES_REMOVED, isArray: true })
  dataCategoriesRemoved: DataCategoryRemoved[];

  @ApiProperty({ enum: DATA_CATEGORIES_RETAINED, isArray: true })
  dataCategoriesRetained: DataCategoryRetained[];
}
