import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum } from 'class-validator';

export enum AnnouncementType {
  TRAVEL = 'travel',
  DEMAND = 'demand',
}

export class SendPublicMessageDto {
  @ApiProperty({
    description: 'Type of announcement',
    enum: AnnouncementType,
    example: AnnouncementType.TRAVEL
  })
  @IsNotEmpty()
  @IsEnum(AnnouncementType)
  announcementType: AnnouncementType;

  @ApiProperty({
    description: 'ID of the travel or demand',
    example: 1,
  })
  @IsNotEmpty()
  announcementId: number;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello, I am interested in your travel',
    minLength: 1,
    maxLength: 1000
  })
  @IsNotEmpty()
  @IsString()
  message: string;
}
