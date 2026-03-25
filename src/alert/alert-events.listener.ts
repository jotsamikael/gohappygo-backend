import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEventType } from 'src/events/event-types';
import { DemandEvent, TravelEvent } from 'src/events/user-events.service';
import { AlertService } from './alert.service';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationType, EntityType, NotificationPriority } from 'src/notification/entities/notification.entity';
import { EmailService } from 'src/email/email.service';
import { EmailTemplatesService } from 'src/email/email-templates.service';
import { DemandEntity } from 'src/demand/demand.entity';
import { TravelEntity } from 'src/travel/travel.entity';

@Injectable()
export class AlertEventsListener {
  private readonly logger = new Logger(AlertEventsListener.name);

  constructor(
    private alertService: AlertService,
    private notificationService: NotificationService,
    private emailService: EmailService,
    private emailTemplatesService: EmailTemplatesService,
    @InjectRepository(DemandEntity)
    private demandRepository: Repository<DemandEntity>,
    @InjectRepository(TravelEntity)
    private travelRepository: Repository<TravelEntity>,
  ) {}

  /**
   * Handle demand published event
   * Check for matching alerts and send notifications/emails
   */
  @OnEvent(UserEventType.DEMAND_PUBLISHED)
  async handleDemandPublished(event: DemandEvent): Promise<void> {
    try {
      this.logger.log(`Checking alerts for demand ${event.demandId} published by ${event.userEmail}`);

      // Fetch demand to get airport IDs
      const demand = await this.demandRepository.findOne({
        where: { id: event.demandId },
        relations: ['departureAirport', 'arrivalAirport'],
      });

      if (!demand) {
        this.logger.warn(`Demand ${event.demandId} not found, skipping alert check`);
        return;
      }

      // Find matching alerts
      const matchingAlerts = await this.alertService.findMatchingAlerts(
        demand.departureAirportId,
        demand.arrivalAirportId,
        demand.flightNumber || null,
        demand.travelDate ? new Date(demand.travelDate) : null,
        'DEMAND',
      );

      if (matchingAlerts.length === 0) {
        this.logger.log(`No matching alerts found for demand ${event.demandId}`);
        return;
      }

      this.logger.log(`Found ${matchingAlerts.length} matching alerts for demand ${event.demandId}`);

      // Process each matching alert
      for (const alert of matchingAlerts) {
        // Skip if alert owner is the same as demand creator
        if (alert.userId === event.userId) {
          continue;
        }

        try {
          // Create notification
          await this.notificationService.create({
            targetUserId: alert.userId,
            actorUserId: event.userId,
            notificationType: NotificationType.DEMAND_MATCHED,
            entityType: EntityType.DEMAND,
            entityId: event.demandId,
            title: 'New Demand Matches Your Alert',
            priority: NotificationPriority.HIGH,
          });

          // Send email
          const emailTemplate = this.emailTemplatesService.getAlertMatchedEmailTemplate({
            userName: alert.user.firstName || 'User',
            alertType: 'Demand',
            departureAirport: demand.departureAirport?.name || 'Unknown',
            arrivalAirport: demand.arrivalAirport?.name || 'Unknown',
            flightNumber: demand.flightNumber || 'N/A',
            travelDate: demand.travelDate ? new Date(demand.travelDate).toLocaleDateString() : 'N/A',
            demandId: event.demandId,
          });

          await this.emailService.sendEmail({
            to: alert.user.email,
            subject: 'New Demand Matches Your Alert - GoHappyGo',
            html: emailTemplate,
          });

          this.logger.log(`Alert notification and email sent to user ${alert.userId} for demand ${event.demandId}`);
        } catch (error) {
          this.logger.error(`Failed to process alert ${alert.id} for demand ${event.demandId}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error handling demand published event: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle travel published event
   * Check for matching alerts and send notifications/emails
   */
  @OnEvent(UserEventType.TRAVEL_PUBLISHED)
  async handleTravelPublished(event: TravelEvent): Promise<void> {
    try {
      this.logger.log(`Checking alerts for travel ${event.travelId} published by ${event.userEmail}`);

      // Fetch travel to get airport IDs
      const travel = await this.travelRepository.findOne({
        where: { id: event.travelId },
        relations: ['departureAirport', 'arrivalAirport'],
      });

      if (!travel) {
        this.logger.warn(`Travel ${event.travelId} not found, skipping alert check`);
        return;
      }

      // Find matching alerts
      const matchingAlerts = await this.alertService.findMatchingAlerts(
        travel.departureAirportId,
        travel.arrivalAirportId,
        travel.flightNumber || null,
        (travel as any).travelDate || travel.departureDatetime ? new Date((travel as any).travelDate ?? travel.departureDatetime) : null,
        'TRAVEL',
      );

      if (matchingAlerts.length === 0) {
        this.logger.log(`No matching alerts found for travel ${event.travelId}`);
        return;
      }

      this.logger.log(`Found ${matchingAlerts.length} matching alerts for travel ${event.travelId}`);

      // Process each matching alert
      for (const alert of matchingAlerts) {
        // Skip if alert owner is the same as travel creator
        if (alert.userId === event.userId) {
          continue;
        }

        try {
          // Create notification
          await this.notificationService.create({
            targetUserId: alert.userId,
            actorUserId: event.userId,
            notificationType: NotificationType.TRAVEL_MATCHED,
            entityType: EntityType.TRAVEL,
            entityId: event.travelId,
            title: 'New Travel Matches Your Alert',
            priority: NotificationPriority.HIGH,
          });

          // Send email
          const emailTemplate = this.emailTemplatesService.getAlertMatchedEmailTemplate({
            userName: alert.user.firstName || 'User',
            alertType: 'Travel',
            departureAirport: travel.departureAirport?.name || 'Unknown',
            arrivalAirport: travel.arrivalAirport?.name || 'Unknown',
            flightNumber: travel.flightNumber || 'N/A',
            travelDate: ((travel as any).travelDate ?? travel.departureDatetime) ? new Date((travel as any).travelDate ?? travel.departureDatetime).toLocaleDateString() : 'N/A',
            travelId: event.travelId,
          });

          await this.emailService.sendEmail({
            to: alert.user.email,
            subject: 'New Travel Matches Your Alert - GoHappyGo',
            html: emailTemplate,
          });

          this.logger.log(`Alert notification and email sent to user ${alert.userId} for travel ${event.travelId}`);
        } catch (error) {
          this.logger.error(`Failed to process alert ${alert.id} for travel ${event.travelId}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error handling travel published event: ${error.message}`, error.stack);
    }
  }
}

