import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { NotificationType, EntityType, NotificationPriority } from '../entities/notification.entity';

export class NotificationActorDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  firstName: string;

  @ApiProperty()
  @Expose()
  lastName: string;

  @ApiProperty()
  @Expose()
  fullName: string;

  @ApiProperty({ required: false })
  @Expose()
  profilePictureUrl?: string;
}

export class NotificationResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty({ enum: NotificationType })
  @Expose()
  notificationType: NotificationType;

  @ApiProperty()
  @Expose()
  targetUserId: number;

  @ApiProperty({ required: false })
  @Expose()
  actorUserId?: number;

  @ApiProperty({ type: NotificationActorDto, required: false })
  @Expose()
  @Type(() => NotificationActorDto)
  actor?: NotificationActorDto;

  @ApiProperty({ enum: EntityType, required: false })
  @Expose()
  entityType?: EntityType;

  @ApiProperty({ required: false })
  @Expose()
  entityId?: number;

  @ApiProperty()
  @Expose()
  title: string;


  @ApiProperty({ enum: NotificationPriority })
  @Expose()
  priority: NotificationPriority;

  @ApiProperty({ required: false })
  @Expose()
  readAt?: Date;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}

export class NotificationCountResponseDto {
  @ApiProperty({ description: 'Count of unread notifications' })
  unreadCount: number;

  @ApiProperty({ description: 'Count of total notifications' })
  totalCount: number;
}

export class PaginatedNotificationsResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items: NotificationResponseDto[];

  @ApiProperty()
  meta: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

