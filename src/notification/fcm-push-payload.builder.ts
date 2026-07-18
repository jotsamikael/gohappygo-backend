import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import {
  NotificationEntity,
  NotificationPriority,
  NotificationType,
} from './entities/notification.entity';

export interface FcmPushDataPayload {
  notificationId: string;
  notificationType: string;
  entityType: string;
  entityId: string;
  actorUserId: string;
  priority: string;
  clickAction: string;
}

const NOTIFICATION_BODY_MAP: Partial<Record<NotificationType, string>> = {
  [NotificationType.REQUEST_SUBMITTED]: 'You received a new request.',
  [NotificationType.REQUEST_ACCEPTED]: 'Your request was accepted.',
  [NotificationType.REQUEST_REJECTED]: 'Your request was rejected.',
  [NotificationType.REQUEST_CANCELLED]: 'Your request was cancelled.',
  [NotificationType.REQUEST_COMPLETED]: 'Your request was completed.',
  [NotificationType.REQUEST_DELIVERED]: 'Your request was delivered.',
  [NotificationType.REVIEW_RECEIVED]: 'You received a new review.',
  [NotificationType.TRAVEL_PUBLISHED]: 'Your travel was published.',
  [NotificationType.DEMAND_PUBLISHED]: 'Your demand was published.',
  [NotificationType.TRAVEL_MATCHED]: 'A new travel matches your alert.',
  [NotificationType.DEMAND_MATCHED]: 'A new demand matches your alert.',
  [NotificationType.PAYMENT_RECEIVED]: 'You received a payment.',
  [NotificationType.PAYMENT_COMPLETED]: 'Your payment was completed.',
  [NotificationType.TRANSACTION_CREATED]: 'A new transaction was created.',
  [NotificationType.ACCOUNT_VERIFIED]: 'Your account was verified.',
  [NotificationType.ACCOUNT_VERIFICATION_FAILED]: 'Your account verification failed.',
  [NotificationType.VERIFICATION_DOCUMENTS_RECEIVED]: 'Your verification documents were received.',
  [NotificationType.SYSTEM_ANNOUNCEMENT]: 'You have a new announcement.',
};

@Injectable()
export class FcmPushPayloadBuilder {
  buildDataPayload(notification: NotificationEntity): FcmPushDataPayload {
    return {
      notificationId: String(notification.id),
      notificationType: notification.notificationType,
      entityType: notification.entityType ?? '',
      entityId: notification.entityId != null ? String(notification.entityId) : '',
      actorUserId: notification.actorUserId != null ? String(notification.actorUserId) : '',
      priority: notification.priority,
      clickAction: 'OPEN_NOTIFICATION',
    };
  }

  buildMessage(
    notification: NotificationEntity,
    pushBody?: string,
  ): Omit<admin.messaging.MulticastMessage, 'tokens'> {
    const data = this.buildDataPayload(notification);
    const body =
      pushBody?.trim() ||
      NOTIFICATION_BODY_MAP[notification.notificationType] ||
      notification.title;
    const isHighPriority =
      notification.priority === NotificationPriority.HIGH ||
      notification.priority === NotificationPriority.URGENT;

    return {
      notification: {
        title: notification.title,
        body,
      },
      data: { ...data },
      android: {
        priority: isHighPriority ? 'high' : 'normal',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };
  }
}
