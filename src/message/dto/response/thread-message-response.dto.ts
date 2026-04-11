import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ThreadMessageUserDto {
  @ApiProperty({ description: 'User ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Display name (Firstname L.)' })
  @Expose()
  fullName: string;

  @ApiProperty({ description: 'User profile picture URL', required: false, nullable: true })
  @Expose()
  profilePictureUrl: string | null;
}

export class ThreadMessageResponseDto {
  @ApiProperty({ description: 'Message ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Message content' })
  @Expose()
  content: string;

  @ApiProperty({ description: 'Whether the message has been read' })
  @Expose()
  isRead: boolean;

  @ApiProperty({ description: 'Message creation date' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Message update date' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ type: ThreadMessageUserDto, description: 'Message sender' })
  @Expose()
  @Type(() => ThreadMessageUserDto)
  sender: ThreadMessageUserDto;

  @ApiProperty({ type: ThreadMessageUserDto, description: 'Message receiver' })
  @Expose()
  @Type(() => ThreadMessageUserDto)
  receiver: ThreadMessageUserDto;
}

