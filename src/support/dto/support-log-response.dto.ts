import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class SupportLogResponseDto {
  @ApiProperty({ description: 'Log ID' })
  @Expose()
  id: number;

  @ApiProperty({ description: 'Support request ID' })
  @Expose()
  supportRequestId: number;

  @ApiProperty({ description: 'Log message' })
  @Expose()
  message: string;

  @ApiProperty({ description: 'Whether the log has been read' })
  @Expose()
  isRead: boolean;

  @ApiProperty({ description: 'Whether the message is from GoHappyGo team' })
  @Expose()
  isGohappyGoTeam: boolean;

  @ApiProperty({ description: 'User ID who created the log', nullable: true })
  @Expose()
  userId: number | null;

  @ApiProperty({ description: 'Full name of user who created the log', nullable: true })
  @Expose()
  userFullName: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  @Expose()
  createdAt: Date;
}

