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

  private async loadPendingCancellationConfirmationRequests(
    pendingCancellationStatusId: number,
  ): Promise<RequestEntity[]> {
    return this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.travel', 'travel')
      .leftJoinAndSelect('request.demand', 'demand')
      .leftJoinAndSelect('request.requester', 'requester')
      .where('request.currentStatusId = :statusId', { statusId: pendingCancellationStatusId })
      .andWhere('request.cancellationRequestedAt IS NOT NULL')
      .andWhere('request.cancellationConfirmedAt IS NULL')
      .andWhere('request.cancellationDisputedAt IS NULL')
      .getMany();
  }

  /**
   * Auto-cancel after CANCELLATION_CONFIRMATION_DAYS, final seller reminder the day before,
   * daily admin digest of all still-pending (only when non-empty).
   * Runs daily at 9 AM
   */
  @Cron('0 9 * * *')
  async processCancellationConfirmations(): Promise<void> {
    this.logger.log('Starting cancellation confirmation processing...');
    const confirmationDays = Number(this.configService.get<number>('CANCELLATION_CONFIRMATION_DAYS', 7)) || 7;
    const dayMs = 1000 * 60 * 60 * 24;

    try {
      const pendingCancellationStatus = await this.requestStatusService.getRequestByStatus('PENDING_CANCELLATION_CONFIRMATION');
      if (!pendingCancellationStatus) {
        this.logger.warn('PENDING_CANCELLATION_CONFIRMATION status not found');
        return;
      }

      const now = new Date();
      let pendingRequests = await this.loadPendingCancellationConfirmationRequests(pendingCancellationStatus.id);

      for (const request of pendingRequests) {
        if (!request.cancellationRequestedAt) continue;
        const requestedDate = new Date(request.cancellationRequestedAt);
        const daysSinceRequest = Math.floor((now.getTime() - requestedDate.getTime()) / dayMs);

        if (daysSinceRequest >= confirmationDays) {
          try {
            await this.requestService.autoConfirmCancellationDueToNoResponse(request.id);
            this.logger.log(`Auto-confirmed cancellation for request ${request.id} (seller non-response)`);
          } catch (error) {
            this.logger.error(
              `Failed to auto-confirm cancellation for request ${request.id}: ${error.message}`,
              error.stack,
            );
          }
        }
      }

      pendingRequests = await this.loadPendingCancellationConfirmationRequests(pendingCancellationStatus.id);

      for (const request of pendingRequests) {
        if (!request.cancellationRequestedAt) continue;
        const requestedDate = new Date(request.cancellationRequestedAt);
        const daysSinceRequest = Math.floor((now.getTime() - requestedDate.getTime()) / dayMs);

        if (confirmationDays > 1 && daysSinceRequest === confirmationDays - 1) {
          const ownerId = request.travelId ? request.travel.userId : (request.demandId ? request.demand.userId : null);
          if (ownerId) {
            const owner = await this.userService.findOne({ id: ownerId });
            if (owner) {
              try {
                await this.emailService.sendCancellationConfirmationRequest(
                  owner.email,
                  owner.firstName,
                  request,
                  true,
                );
                this.logger.log(`Sent final reminder to seller for request ${request.id}`);
              } catch (error) {
                this.logger.error(`Failed to send final reminder for request ${request.id}: ${error.message}`);
              }
            }
          }
        }
      }

      pendingRequests = await this.loadPendingCancellationConfirmationRequests(pendingCancellationStatus.id);

      if (pendingRequests.length > 0) {
        await this.sendAdminCancellationPendingNotification(pendingRequests);
      }

      this.logger.log(`Cancellation confirmation job: ${pendingRequests.length} still pending after processing`);
    } catch (error) {
      this.logger.error(`Error in cancellation confirmation processing: ${error.message}`, error.stack);
    }
  }

  /**
   * Send email to admin users about pending cancellation confirmations (daily digest)
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
          this.logger.log(`Sent admin pending-cancellation digest to ${admin.email} (${requests.length} request(s))`);
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
