import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationResponseDto, NotificationActorDto } from './dto/notification-response.dto';
import { CommonService } from 'src/common/service/common.service';

@Injectable()
export class NotificationMapper {
  constructor(private commonService: CommonService) {}

  toResponseDto(notification: NotificationEntity): NotificationResponseDto {
    const actor = notification.actor ? plainToInstance(NotificationActorDto, {
      id: notification.actor.id,
      firstName: notification.actor.firstName,
      lastName: notification.actor.lastName,
      fullName: this.commonService.formatFullName(notification.actor.firstName, notification.actor.lastName),
      profilePictureUrl: notification.actor.profilePictureUrl || null,
    }, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true
    }) : null;

    const mapped = plainToInstance(NotificationResponseDto, {
      id: notification.id,
      notificationType: notification.notificationType,
      targetUserId: notification.targetUserId,
      actorUserId: notification.actorUserId,
      actor: actor,
      entityType: notification.entityType,
      entityId: notification.entityId,
      title: notification.title,
      priority: notification.priority,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    }, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true
    });

    // Manually assign actor to ensure it's not lost
    (mapped as any).actor = actor;

    return mapped;
  }
}

