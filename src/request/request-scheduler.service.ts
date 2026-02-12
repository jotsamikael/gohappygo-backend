import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RequestEntity } from './request.entity';
import { RequestService } from './request.service';
import { RequestStatusService } from 'src/request-status/request-status.service';
import { UserService } from 'src/user/user.service';
import { RoleService } from 'src/role/role.service';
import { UserEntity, UserRole } from 'src/user/user.entity';
import { EmailService } from 'src/email/email.service';
import { EmailTemplatesService } from 'src/email/email-templates.service';

@Injectable()
export class RequestSchedulerService {
  private readonly logger = new Logger(RequestSchedulerService.name);

  constructor(
    @InjectRepository(RequestEntity)
    private requestRepository: Repository<RequestEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private requestService: RequestService,
    private requestStatusService: RequestStatusService,
    private userService: UserService,
    private roleService: RoleService,
    private emailService: EmailService,
    private emailTemplatesService: EmailTemplatesService,
    private configService: ConfigService,
  ) {}

  /**
   * Auto-complete requests that haven't been completed after specified days past travel date
   * Runs daily at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processAutoCompletion(): Promise<void> {
    this.logger.log('Starting auto-completion processing...');
    try {
      const result = await this.requestService.autoCompleteRequests();
      this.logger.log(`Auto-completion completed: ${result.completed} requests completed, ${result.errors} errors`);
    } catch (error) {
      this.logger.error(`Error in auto-completion processing: ${error.message}`, error.stack);
    }
  }

  /**
   * Send reminders and admin notifications for pending cancellation confirmations
   * Runs daily at 9 AM
   */
  @Cron('0 9 * * *')
  async processCancellationConfirmations(): Promise<void> {
    this.logger.log('Starting cancellation confirmation processing...');
    const confirmationDays = this.configService.get<number>('CANCELLATION_CONFIRMATION_DAYS', 7);

    try {
      const pendingCancellationStatus = await this.requestStatusService.getRequestByStatus('PENDING_CANCELLATION_CONFIRMATION');
      if (!pendingCancellationStatus) {
        this.logger.warn('PENDING_CANCELLATION_CONFIRMATION status not found');
        return;
      }

      const now = new Date();
      const deadlineDate = new Date(now);
      deadlineDate.setDate(deadlineDate.getDate() - confirmationDays);

      // Find requests pending confirmation
      const pendingRequests = await this.requestRepository
        .createQueryBuilder('request')
        .leftJoinAndSelect('request.travel', 'travel')
        .leftJoinAndSelect('request.demand', 'demand')
        .leftJoinAndSelect('request.requester', 'requester')
        .where('request.currentStatusId = :statusId', { statusId: pendingCancellationStatus.id })
        .andWhere('request.cancellationRequestedAt IS NOT NULL')
        .andWhere('request.cancellationConfirmedAt IS NULL')
        .andWhere('request.cancellationDisputedAt IS NULL')
        .getMany();

      const adminNotificationRequests: RequestEntity[] = [];

      for (const request of pendingRequests) {
        if (!request.cancellationRequestedAt) continue;

        const requestedDate = new Date(request.cancellationRequestedAt);
        const daysSinceRequest = Math.floor((now.getTime() - requestedDate.getTime()) / (1000 * 60 * 60 * 24));

        // If deadline passed, add to admin notification list
        if (requestedDate <= deadlineDate) {
          adminNotificationRequests.push(request);
        } else if (daysSinceRequest >= confirmationDays - 1) {
          // Send reminder to seller (1 day before deadline)
          const ownerId = request.travelId ? request.travel.userId : (request.demandId ? request.demand.userId : null);
          if (ownerId) {
            const owner = await this.userService.findOne({ id: ownerId });
            if (owner) {
              try {
                await this.emailService.sendCancellationConfirmationRequest(
                  owner.email,
                  owner.firstName,
                  request,
                  true // isReminder
                );
                this.logger.log(`Sent reminder to seller for request ${request.id}`);
              } catch (error) {
                this.logger.error(`Failed to send reminder for request ${request.id}: ${error.message}`);
              }
            }
          }
        }
      }

      // Send admin notification if there are requests past deadline
      if (adminNotificationRequests.length > 0) {
        await this.sendAdminCancellationPendingNotification(adminNotificationRequests);
      }

      this.logger.log(`Processed ${pendingRequests.length} pending cancellation confirmations`);
    } catch (error) {
      this.logger.error(`Error in cancellation confirmation processing: ${error.message}`, error.stack);
    }
  }

  /**
   * Send email to admin users about pending cancellation confirmations
   */
  private async sendAdminCancellationPendingNotification(requests: RequestEntity[]): Promise<void> {
    try {
      const adminUsers = await this.getAdminUsers();
      if (adminUsers.length === 0) {
        this.logger.warn('No admin users found for cancellation pending notification');
        return;
      }

      for (const admin of adminUsers) {
        try {
          await this.emailService.sendAdminCancellationPending(admin.email, admin.firstName, requests);
          this.logger.log(`Sent admin notification to ${admin.email} for ${requests.length} pending cancellations`);
        } catch (error) {
          this.logger.error(`Failed to send admin notification to ${admin.email}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error sending admin cancellation pending notifications: ${error.message}`, error.stack);
    }
  }

  /**
   * Get all admin users
   */
  private async getAdminUsers(): Promise<UserEntity[]> {
    try {
      const adminRole = await this.roleService.getUserRoleIdByCode('ADMIN');
      if (!adminRole) {
        this.logger.warn('Admin role not found');
        return [];
      }

      const adminUsers = await this.userRepository.find({
        where: { roleId: adminRole.id },
        relations: ['role'],
      });

      return adminUsers.filter(user => user.role?.code === UserRole.ADMIN);
    } catch (error) {
      this.logger.error(`Error fetching admin users: ${error.message}`, error.stack);
      return [];
    }
  }
}
