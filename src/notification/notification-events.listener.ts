import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from './notification.service';
import { NotificationType, EntityType, NotificationPriority } from './entities/notification.entity';
import { NotificationPushMessages } from './notification-push-messages';
import { RequestEvent, DemandEvent, TravelEvent, MessageEvent } from 'src/events/user-events.service';
import { UserEventType } from 'src/events/event-types';

@Injectable()
export class NotificationEventsListener {
  private readonly logger = new Logger(NotificationEventsListener.name);

  constructor(private notificationService: NotificationService) {}

  /**
   * Handle request submitted event
   */
  @OnEvent('request.created')
  async handleRequestCreated(event: RequestEvent) {
    try {
      // Only create notification for the owner (isForOwner=true)
      // The first emission (isForOwner=false) is for email purposes only
      if (!event.isForOwner) {
        return;
      }

      const copy = NotificationPushMessages.requestSubmittedForSeller;

      await this.notificationService.create({
        targetUserId: event.ownerId,
        actorUserId: event.requesterId,
        notificationType: NotificationType.REQUEST_SUBMITTED,
        entityType: EntityType.REQUEST,
        entityId: event.requestId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.HIGH,
      });

      this.logger.log(`Notification created for request submission: Request ${event.requestId} by user ${event.requesterId}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for request.created: ${error.message}`);
    }
  }

  /**
   * Handle request accepted event
   */
  @OnEvent('request.accepted')
  async handleRequestAccepted(event: RequestEvent) {
    try {
      const copy = event.isForOwner
        ? NotificationPushMessages.requestAcceptedForSeller
        : NotificationPushMessages.requestAcceptedForBuyer;

      await this.notificationService.create({
        targetUserId: event.isForOwner ? event.ownerId : event.requesterId,
        actorUserId: event.isForOwner ? event.requesterId : event.ownerId,
        notificationType: NotificationType.REQUEST_ACCEPTED,
        entityType: EntityType.REQUEST,
        entityId: event.requestId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.HIGH,
      });

      this.logger.log(
        `Notification created for request acceptance: Request ${event.requestId} (${event.isForOwner ? 'owner' : 'requester'})`,
      );
    } catch (error) {
      this.logger.error(`Failed to create notification for request.accepted: ${error.message}`);
    }
  }

  /**
   * Handle request cancelled event
   */
  @OnEvent('request.cancelled')
  async handleRequestCancelled(event: RequestEvent) {
    try {
      const isPaymentFailure = Boolean(event.cancellationReason);
      const copy = event.isForOwner
        ? isPaymentFailure
          ? NotificationPushMessages.requestCancelledPaymentFailureForSeller
          : NotificationPushMessages.requestCancelledForSeller
        : isPaymentFailure
          ? NotificationPushMessages.requestCancelledPaymentFailureForBuyer
          : NotificationPushMessages.requestCancelledForBuyer;

      await this.notificationService.create({
        targetUserId: event.isForOwner ? event.ownerId : event.requesterId,
        actorUserId: event.isForOwner ? event.requesterId : event.ownerId,
        notificationType: NotificationType.REQUEST_CANCELLED,
        entityType: EntityType.REQUEST,
        entityId: event.requestId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.HIGH,
      });

      this.logger.log(
        `Notification created for request cancellation: Request ${event.requestId} (${event.isForOwner ? 'owner' : 'requester'})`,
      );
    } catch (error) {
      this.logger.error(`Failed to create notification for request.cancelled: ${error.message}`);
    }
  }

  /**
   * Handle request rejected event
   */
  @OnEvent('request.rejected')
  async handleRequestRejected(event: RequestEvent) {
    try {
      const copy = event.isForOwner
        ? NotificationPushMessages.requestRejectedForSeller
        : NotificationPushMessages.requestRejectedForBuyer;

      await this.notificationService.create({
        targetUserId: event.isForOwner ? event.ownerId : event.requesterId,
        actorUserId: event.isForOwner ? event.requesterId : event.ownerId,
        notificationType: NotificationType.REQUEST_REJECTED,
        entityType: EntityType.REQUEST,
        entityId: event.requestId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.HIGH,
      });

      this.logger.log(
        `Notification created for request rejection: Request ${event.requestId} (${event.isForOwner ? 'owner' : 'requester'})`,
      );
    } catch (error) {
      this.logger.error(`Failed to create notification for request.rejected: ${error.message}`);
    }
  }

  /**
   * Handle request completed event
   */
  @OnEvent('request.completed')
  async handleRequestCompleted(event: RequestEvent) {
    try {
      const copy = event.isForOwner
        ? NotificationPushMessages.requestCompletedForSeller
        : NotificationPushMessages.requestCompletedForBuyer;

      await this.notificationService.create({
        targetUserId: event.isForOwner ? event.ownerId : event.requesterId,
        actorUserId: event.isForOwner ? event.requesterId : event.ownerId,
        notificationType: NotificationType.REQUEST_COMPLETED,
        entityType: EntityType.REQUEST,
        entityId: event.requestId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.NORMAL,
      });

      this.logger.log(
        `Notification created for request completion: Request ${event.requestId} (${event.isForOwner ? 'owner' : 'requester'})`,
      );
    } catch (error) {
      this.logger.error(`Failed to create notifications for request.completed: ${error.message}`);
    }
  }

  /**
   * Handle review received event
   */
  @OnEvent('review.created')
  async handleReviewCreated(event: { reviewId: number; reviewerId: number; revieweeId: number; reviewerName: string; rating: number }) {
    try {
      const copy = NotificationPushMessages.reviewReceived;

      await this.notificationService.create({
        targetUserId: event.revieweeId,
        actorUserId: event.reviewerId,
        notificationType: NotificationType.REVIEW_RECEIVED,
        entityType: EntityType.REVIEW,
        entityId: event.reviewId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.NORMAL,
      });

      this.logger.log(`Notification created for review: Review ${event.reviewId} by user ${event.reviewerId}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for review.created: ${error.message}`);
    }
  }

  /**
   * Handle demand published event
   */
  @OnEvent('demand.published')
  async handleDemandPublished(event: DemandEvent) {
    try {
      const copy = NotificationPushMessages.demandPublished;

      await this.notificationService.create({
        targetUserId: event.userId,
        notificationType: NotificationType.DEMAND_PUBLISHED,
        entityType: EntityType.DEMAND,
        entityId: event.demandId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.NORMAL,
      });

      this.logger.log(`Notification created for demand publication: Demand ${event.demandId} by user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for demand.published: ${error.message}`);
    }
  }

  /**
   * Handle travel published event
   */
  @OnEvent('travel.published')
  async handleTravelPublished(event: TravelEvent) {
    try {
      const copy = NotificationPushMessages.travelPublished;

      await this.notificationService.create({
        targetUserId: event.userId,
        notificationType: NotificationType.TRAVEL_PUBLISHED,
        entityType: EntityType.TRAVEL,
        entityId: event.travelId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.NORMAL,
      });

      this.logger.log(`Notification created for travel publication: Travel ${event.travelId} by user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for travel.published: ${error.message}`);
    }
  }

  /**
   * Handle account verification success
   */
  @OnEvent('user.verified')
  async handleAccountVerified(event: { userId: number; userName: string }) {
    try {
      const copy = NotificationPushMessages.accountVerified;

      await this.notificationService.create({
        targetUserId: event.userId,
        notificationType: NotificationType.ACCOUNT_VERIFIED,
        entityType: EntityType.USER,
        entityId: event.userId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.HIGH,
      });

      this.logger.log(`Notification created for account verification: User ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for user.verified: ${error.message}`);
    }
  }

  /**
   * Handle verification documents received
   */
  @OnEvent('user.documents.received')
  async handleVerificationDocumentsReceived(event: { userId: number; userName: string }) {
    try {
      const copy = NotificationPushMessages.verificationDocumentsReceived;

      await this.notificationService.create({
        targetUserId: event.userId,
        notificationType: NotificationType.VERIFICATION_DOCUMENTS_RECEIVED,
        entityType: EntityType.USER,
        entityId: event.userId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.NORMAL,
      });

      this.logger.log(`Notification created for documents received: User ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for user.documents.received: ${error.message}`);
    }
  }

  /**
   * Handle chat message sent — FCM + in-app notification for the receiver.
   */
  @OnEvent(UserEventType.MESSAGE_SENT)
  async handleMessageSent(event: MessageEvent) {
    try {
      if (event.receiverId === event.userId) {
        return;
      }

      const copy = NotificationPushMessages.messageReceived;
      const senderLabel = event.userFirstName?.trim() || 'Someone';
      const preview = this.truncateChatPreview(event.content);
      const body = preview ? `${senderLabel}: ${preview}` : copy.body;

      await this.notificationService.create({
        targetUserId: event.receiverId,
        actorUserId: event.userId,
        notificationType: NotificationType.MESSAGE_RECEIVED,
        entityType: EntityType.REQUEST,
        entityId: event.requestId,
        title: copy.title,
        body,
        priority: NotificationPriority.NORMAL,
      });

      this.logger.log(
        `Notification created for chat message: message ${event.messageId}, request ${event.requestId} → user ${event.receiverId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create notification for message.sent: ${error.message}`);
    }
  }

  private truncateChatPreview(content: string, maxLength = 120): string {
    const normalized = (content ?? '').trim().replace(/\s+/g, ' ');
    if (!normalized) {
      return '';
    }
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength - 1)}…`;
  }

  /**
   * Handle payment received
   */
  @OnEvent('payment.received')
  async handlePaymentReceived(event: { userId: number; transactionId: number; amount: number; currency: string }) {
    try {
      const copy = NotificationPushMessages.paymentReceived;

      await this.notificationService.create({
        targetUserId: event.userId,
        notificationType: NotificationType.PAYMENT_RECEIVED,
        entityType: EntityType.TRANSACTION,
        entityId: event.transactionId,
        title: copy.title,
        body: copy.body,
        priority: NotificationPriority.HIGH,
      });

      this.logger.log(`Notification created for payment received: Transaction ${event.transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for payment.received: ${error.message}`);
    }
  }
}
