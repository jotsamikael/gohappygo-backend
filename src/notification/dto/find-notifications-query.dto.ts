import { IsOptional, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType, NotificationPriority } from '../entities/notification.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class FindNotificationsQueryDto extends PaginationQueryDto {
  @ApiProperty({ 
    enum: NotificationType, 
    description: 'Filter by notification type',
    required: false 
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiProperty({ 
    description: 'Filter to show only unread notifications',
    required: false,
    type: Boolean
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiProperty({ 
    enum: NotificationPriority,
    description: 'Filter by priority level',
    required: false 
  })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @ApiProperty({ 
    description: 'Filter notifications from this date (ISO 8601)',
    required: false 
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ 
    description: 'Filter notifications until this date (ISO 8601)',
    required: false 
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

