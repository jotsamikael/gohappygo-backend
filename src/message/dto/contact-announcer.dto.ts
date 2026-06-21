import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { PublicIdPrefix } from 'src/common/public-id/public-id-prefix.enum';
import { isValidPublicId } from 'src/common/public-id/public-id.util';

export enum AnnouncementType {
  TRAVEL = 'travel',
  DEMAND = 'demand',
}

export class ContactAnnouncerDto {
  @ApiProperty({
    description: 'Type of announcement',
    enum: AnnouncementType,
    example: AnnouncementType.DEMAND,
  })
  @IsNotEmpty()
  @IsEnum(AnnouncementType)
  announcementType: AnnouncementType;

  @ApiProperty({
    description: 'Public ID of the travel or demand',
    example: 'dm_01KVD6D8C1M432RYJVPPCJ1RM8',
  })
  @IsNotEmpty()
  @IsString()
  publicId: string;

  @ApiProperty({
    description: 'Message content sent to the announcement creator',
    example: 'Hello, I am interested in your travel',
    minLength: 1,
    maxLength: 1000,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message: string;
}

export function getExpectedPublicIdPrefix(announcementType: AnnouncementType): PublicIdPrefix {
  return announcementType === AnnouncementType.TRAVEL
    ? PublicIdPrefix.TRAVEL
    : PublicIdPrefix.DEMAND;
}

export function isValidAnnouncementPublicId(
  publicId: string,
  announcementType: AnnouncementType,
): boolean {
  return isValidPublicId(publicId, getExpectedPublicIdPrefix(announcementType));
}
