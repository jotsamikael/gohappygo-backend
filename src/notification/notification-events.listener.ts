import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from './notification.service';
import { NotificationType, EntityType, NotificationPriority } from './entities/notification.entity';
import { RequestEvent, DemandEvent, TravelEvent } from 'src/events/user-events.service';

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
        return; // Skip notification creation for requester's own action
      }

      // Notify the travel/demand owner that someone submitted a request
      await this.notificationService.create({
        targetUserId: event.ownerId,
        actorUserId: event.requesterId,
        notificationType: NotificationType.REQUEST_SUBMITTED,
        entityType: EntityType.REQUEST,
        entityId: event.requestId,
        title: 'New Request Received',
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
      // Only create notification for the requester (isForOwner=true means this event is for the requester)
      // The first emission (isForOwner=false) is for the owner's email only
      if (!event.isForOwner) {
        return; // Skip notification creation for owner's own action
      }

      // Notify the requester that their request was accepted
      await this.notificationService.create({
        targetUserId: event.requesterId,
        actorUserId: event.ownerId,
        notificationType: NotificationType.REQUEST_ACCEPTED,
        entityType: EntityType.REQUEST,
        entityId: event.requestId,
        title: 'Request Accepted',
        priority: NotificationPriority.HIGH,
      });

      this.logger.log(`Notification created for request acceptance: Request ${event.requestId}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for request.accepted: ${error.message}`);
    }
  }

  /**
   * Handle request completed event
   */
  @OnEvent('request.completed')
  async handleRequestCompleted(event: RequestEvent) {
    try {
      // For request.completed, we want to notify based on isForOwner flag
      // If isForOwner=true, notify the owner; if false, notify the requester
      if (event.isForOwner) {
        // Notify owner
        await this.notificationService.create({
          targetUserId: event.ownerId,
          actorUserId: event.requesterId,
          notificationType: NotificationType.REQUEST_COMPLETED,
          entityType: EntityType.REQUEST,
          entityId: event.requestId,
          title: 'Request Completed',
          priority: NotificationPriority.NORMAL,
        });
      } else {
        // Notify requester
        await this.notificationService.create({
          targetUserId: event.requesterId,
          actorUserId: event.ownerId,
          notificationType: NotificationType.REQUEST_COMPLETED,
          entityType: EntityType.REQUEST,
          entityId: event.requestId,
          title: 'Request Completed',
          priority: NotificationPriority.NORMAL,
        });
      }

      this.logger.log(`Notification created for request completion: Request ${event.requestId}`);
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
      await this.notificationService.create({
        targetUserId: event.revieweeId,
        actorUserId: event.reviewerId,
        notificationType: NotificationType.REVIEW_RECEIVED,
        entityType: EntityType.REVIEW,
        entityId: event.reviewId,
        title: 'New Review Received',
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
      await this.notificationService.create({
        targetUserId: event.userId,
        notificationType: NotificationType.DEMAND_PUBLISHED,
        entityType: EntityType.DEMAND,
        entityId: event.demandId,
        title: 'Demand Published Successfully',
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
      await this.notificationService.create({
        targetUserId: event.userId,
        notificationType: NotificationType.TRAVEL_PUBLISHED,
        entityType: EntityType.TRAVEL,
        entityId: event.travelId,
        title: 'Travel Published Successfully',
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
      await this.notificationService.create({
        targetUserId: event.userId,
        notificationType: NotificationType.ACCOUNT_VERIFIED,
        entityType: EntityType.USER,
        entityId: event.userId,
        title: 'Account Verified',
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
      await this.notificationService.create({
        targetUserId: event.userId,
        notificationType: NotificationType.VERIFICATION_DOCUMENTS_RECEIVED,
        entityType: EntityType.USER,
        entityId: event.userId,
        title: 'Verification Documents Received',
        priority: NotificationPriority.NORMAL,
      });

      this.logger.log(`Notification created for documents received: User ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for user.documents.received: ${error.message}`);
    }
  }

  /**
   * Handle payment received
   */
  @OnEvent('payment.received')
  async handlePaymentReceived(event: { userId: number; transactionId: number; amount: number; currency: string }) {
    try {
      await this.notificationService.create({
        targetUserId: event.userId,
        notificationType: NotificationType.PAYMENT_RECEIVED,
        entityType: EntityType.TRANSACTION,
        entityId: event.transactionId,
        title: 'Payment Received',
        priority: NotificationPriority.HIGH,
      });

      this.logger.log(`Notification created for payment received: Transaction ${event.transactionId}`);
    } catch (error) {
      this.logger.error(`Failed to create notification for payment.received: ${error.message}`);
    }
  }
}

