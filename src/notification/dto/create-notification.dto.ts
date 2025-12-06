import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { NotificationType, EntityType, NotificationPriority } from '../entities/notification.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType, description: 'Type of notification' })
  @IsEnum(NotificationType)
  notificationType: NotificationType;

  @ApiProperty({ description: 'User ID who receives the notification' })
  @IsInt()
  targetUserId: number;

  @ApiProperty({ description: 'User ID who triggered the notification', required: false })
  @IsOptional()
  @IsInt()
  actorUserId?: number;

  @ApiProperty({ enum: EntityType, description: 'Type of related entity', required: false })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @ApiProperty({ description: 'ID of the related entity', required: false })
  @IsOptional()
  @IsInt()
  entityId?: number;

  @ApiProperty({ description: 'Notification title', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title: string;


  @ApiProperty({ enum: NotificationPriority, description: 'Priority level', required: false, default: NotificationPriority.NORMAL })
  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;
}
