import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserEntity } from 'src/user/user.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { RequestEntity } from 'src/request/request.entity';
import { BookmarkEntity } from 'src/bookmark/entities/bookmark.entity';
import { AlertEntity } from 'src/alert/entities/alert.entity';
import { MessageEntity } from 'src/message/message.entity';
import { EmailVerificationEntity } from 'src/email-verification/email-verification.entity';
import { PhoneVerificationEntity } from 'src/phone-verification/phone-verification.entity';
import { PasswordResetEntity } from 'src/password-reset/password-reset.entity';
import { NotificationEntity } from 'src/notification/entities/notification.entity';
import { SupportRequestEntity } from 'src/support/entities/support-request.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { DemandService } from 'src/demand/demand.service';
import { TravelService } from 'src/travel/travel.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { FirebaseAuthService } from 'src/firebase/firebase-auth.service';
import { DeviceTokenService } from 'src/notification/device-token.service';
import { EmailService } from 'src/email/email.service';
import { EmailTemplatesService } from 'src/email/email-templates.service';
import { CustomBadRequestException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { AccountDeletionAuditEntity } from './account-deletion-audit.entity';
import {
  AccountStatus,
  DATA_CATEGORIES_REMOVED,
  DATA_CATEGORIES_RETAINED,
  DeleteAccountOptions,
  DeletionResult,
} from './account-deletion.types';

const MESSAGE_REMOVED_CONTENT = '[Message removed — account deleted]';

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(DemandEntity)
    private readonly demandRepository: Repository<DemandEntity>,
    @InjectRepository(TravelEntity)
    private readonly travelRepository: Repository<TravelEntity>,
    @InjectRepository(RequestEntity)
    private readonly requestRepository: Repository<RequestEntity>,
    @InjectRepository(BookmarkEntity)
    private readonly bookmarkRepository: Repository<BookmarkEntity>,
    @InjectRepository(AlertEntity)
    private readonly alertRepository: Repository<AlertEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
    @InjectRepository(EmailVerificationEntity)
    private readonly emailVerificationRepository: Repository<EmailVerificationEntity>,
    @InjectRepository(PhoneVerificationEntity)
    private readonly phoneVerificationRepository: Repository<PhoneVerificationEntity>,
    @InjectRepository(PasswordResetEntity)
    private readonly passwordResetRepository: Repository<PasswordResetEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    @InjectRepository(SupportRequestEntity)
    private readonly supportRequestRepository: Repository<SupportRequestEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionRepository: Repository<TransactionEntity>,
    @InjectRepository(AccountDeletionAuditEntity)
    private readonly auditRepository: Repository<AccountDeletionAuditEntity>,
    private readonly demandService: DemandService,
    private readonly travelService: TravelService,
    private readonly fileUploadService: FileUploadService,
    private readonly firebaseAuthService: FirebaseAuthService,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly emailService: EmailService,
    private readonly emailTemplatesService: EmailTemplatesService,
  ) {}

  /**
   * GDPR-compliant account closure: prechecks, PII scrub/tombstone, ephemeral cleanup, soft-delete.
   * Keeps marketplace rows (requests, transactions, listings) for FK integrity and legal retention.
   */
  async anonymizeAndCloseAccount(
    user: UserEntity,
    options: DeleteAccountOptions = {},
  ): Promise<DeletionResult> {
    if (options.confirmEmail && options.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new CustomBadRequestException(
        'Confirmation email does not match your account email.',
        ErrorCode.ACCOUNT_DELETION_EMAIL_MISMATCH,
      );
    }

    if (user.accountStatus === AccountStatus.ANONYMIZED || user.deletedAt) {
      throw new CustomBadRequestException(
        'Account is already deleted.',
        ErrorCode.ACCOUNT_ALREADY_DELETED,
      );
    }

    await this.runPrechecks(user.id);

    const originalEmail = user.email;
    const originalEmailHash = crypto.createHash('sha256').update(originalEmail.toLowerCase()).digest('hex');
    const firebaseUid = user.firebaseUid ?? null;
    const requestedAt = new Date();

    await this.sendDeletionConfirmationEmail(user, originalEmail);

    await this.revokeAccess(user.id);
    await this.purgeUserFiles(user.id);
    await this.cleanupEphemeralData(user.id);
    await this.scrubCommunications(user.id);
    await this.redactSupportRequests(originalEmail, user.id);
    await this.cancelFutureListings(user.id);
    await this.anonymizeUserRow(user, originalEmailHash, requestedAt);

    if (firebaseUid) {
      await this.deleteFirebaseUserSafe(firebaseUid);
    }

    const deletedAt = new Date();
    await this.usersRepository.softDelete(user.id);

    await this.auditRepository.save(
      this.auditRepository.create({
        userId: user.id,
        requestedAt,
        completedAt: deletedAt,
        requestIp: options.requestIp ?? null,
        appVersion: options.appVersion ?? null,
        originalEmailHash,
      }),
    );

    return {
      message: 'Account deleted and personal data anonymized successfully',
      deletedAt,
      dataCategoriesRemoved: [...DATA_CATEGORIES_REMOVED],
      dataCategoriesRetained: [...DATA_CATEGORIES_RETAINED],
    };
  }

  private async runPrechecks(userId: number): Promise<void> {
    const blockedStatuses = ['ACCEPTED', 'NEGOCIATING'];
    const activeReqCount = await this.requestRepository
      .createQueryBuilder('r')
      .leftJoin('r.currentStatus', 'status')
      .leftJoin('r.travel', 'travel')
      .leftJoin('travel.user', 'travelUser')
      .leftJoin('r.demand', 'demand')
      .leftJoin('demand.user', 'demandUser')
      .where('r.requesterId = :uid OR travelUser.id = :uid OR demandUser.id = :uid', { uid: userId })
      .andWhere('status.status IN (:...blocked)', { blocked: blockedStatuses })
      .getCount();

    if (activeReqCount > 0) {
      throw new CustomBadRequestException(
        'Account cannot be deleted while a request is in ACCEPTED or NEGOCIATING status.',
        ErrorCode.REQUEST_IN_ACCEPTED_OR_NEGOCIATING_STATUS,
      );
    }

    const pendingCancellationCount = await this.requestRepository
      .createQueryBuilder('r')
      .leftJoin('r.currentStatus', 'status')
      .leftJoin('r.travel', 'travel')
      .leftJoin('travel.user', 'travelUser')
      .leftJoin('r.demand', 'demand')
      .leftJoin('demand.user', 'demandUser')
      .where('r.requesterId = :uid OR travelUser.id = :uid OR demandUser.id = :uid', { uid: userId })
      .andWhere('status.status = :pendingStatus', { pendingStatus: 'PENDING_CANCELLATION_CONFIRMATION' })
      .getCount();

    if (pendingCancellationCount > 0) {
      throw new CustomBadRequestException(
        'Account cannot be deleted while a request is awaiting cancellation confirmation.',
        ErrorCode.ACCOUNT_DELETION_PENDING_CANCELLATION,
      );
    }

    const pendingPayoutCount = await this.transactionRepository
      .createQueryBuilder('t')
      .where('(t.payerId = :uid OR t.payeeId = :uid)', { uid: userId })
      .andWhere('t.status IN (:...statuses)', {
        statuses: ['pending', 'paid', 'awaiting_transfer', 'awaiting_available_funds'],
      })
      .andWhere('t.stripeTransferId IS NULL')
      .getCount();

    if (pendingPayoutCount > 0) {
      throw new CustomBadRequestException(
        'Account cannot be deleted while you have pending payments or payouts.',
        ErrorCode.ACCOUNT_DELETION_PENDING_PAYOUTS,
      );
    }
  }

  private async sendDeletionConfirmationEmail(user: UserEntity, email: string): Promise<void> {
    try {
      const html = this.emailTemplatesService.getAccountDeletionConfirmationTemplate(user);
      await this.emailService.sendEmail({
        to: email,
        subject: 'Your GoHappyGo account has been deleted',
        html,
      });
    } catch (error) {
      this.logger.warn(`Failed to send account deletion confirmation email for user ${user.id}: ${error.message}`);
    }
  }

  private async revokeAccess(userId: number): Promise<void> {
    await this.deviceTokenService.deleteAllForUser(userId);
  }

  private async purgeUserFiles(userId: number): Promise<void> {
    await this.fileUploadService.deleteUserVerificationFiles(userId);
    await this.fileUploadService.deleteUserProfilePicture(userId);
  }

  private async cleanupEphemeralData(userId: number): Promise<void> {
    await this.bookmarkRepository.delete({ userId });
    await this.alertRepository.softDelete({ userId });
    await this.emailVerificationRepository
      .createQueryBuilder()
      .delete()
      .from(EmailVerificationEntity)
      .where('userId = :userId', { userId })
      .execute();
    await this.phoneVerificationRepository
      .createQueryBuilder()
      .delete()
      .from(PhoneVerificationEntity)
      .where('userId = :userId', { userId })
      .execute();
    await this.passwordResetRepository
      .createQueryBuilder()
      .delete()
      .from(PasswordResetEntity)
      .where('userId = :userId', { userId })
      .execute();
    await this.notificationRepository.softDelete({ targetUserId: userId });
  }

  private async scrubCommunications(userId: number): Promise<void> {
    await this.messageRepository
      .createQueryBuilder()
      .update(MessageEntity)
      .set({ content: MESSAGE_REMOVED_CONTENT })
      .where('senderId = :userId OR receiverId = :userId', { userId })
      .execute();
  }

  private async redactSupportRequests(email: string, userId: number): Promise<void> {
    const tombstoneEmail = this.buildTombstoneEmail(userId, email);
    await this.supportRequestRepository
      .createQueryBuilder()
      .update(SupportRequestEntity)
      .set({ email: tombstoneEmail })
      .where('LOWER(email) = LOWER(:email)', { email })
      .execute();
  }

  private async cancelFutureListings(userId: number): Promise<void> {
    const now = new Date();

    const futureDemands = await this.demandRepository
      .createQueryBuilder('d')
      .where('d.userId = :uid', { uid: userId })
      .andWhere('DATE(d.travelDate) >= DATE(:today)', { today: now })
      .getMany();

    for (const demand of futureDemands) {
      await this.demandService.cancelDemand(demand.id);
    }

    const futureTravels = await this.travelRepository
      .createQueryBuilder('t')
      .where('t.userId = :uid', { uid: userId })
      .andWhere('(t.travelDate >= :now OR (t.travelDate IS NULL AND t.departureDatetime >= :now))', { now })
      .getMany();

    for (const travel of futureTravels) {
      await this.travelService.cancelTravel(travel.id);
    }
  }

  private async anonymizeUserRow(
    user: UserEntity,
    originalEmailHash: string,
    requestedAt: Date,
  ): Promise<void> {
    const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const tombstoneEmail = this.buildTombstoneEmail(user.id, user.email);
    const tombstonePhone = this.buildTombstonePhone(user.id);

    await this.usersRepository.update(user.id, {
      email: tombstoneEmail,
      phone: tombstonePhone,
      firstName: 'Deleted',
      lastName: 'User',
      username: undefined,
      bio: undefined,
      profilePictureUrl: undefined,
      password: unusablePassword,
      firebaseUid: undefined,
      kycReference: undefined,
      kycProvider: undefined,
      kycStatus: 'uninitiated',
      kycUpdatedAt: undefined,
      isEmailVerified: false,
      isPhoneVerified: false,
      isVerified: false,
      accountStatus: AccountStatus.ANONYMIZED,
      anonymizedAt: new Date(),
      deletionRequestedAt: requestedAt,
      originalEmailHash,
    } as Partial<UserEntity>);
  }

  private buildTombstoneEmail(userId: number, originalEmail: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${userId}:${originalEmail}:${Date.now()}`)
      .digest('hex')
      .slice(0, 12);
    return `deleted+${userId}+${hash}@anonymized.gohappygo.invalid`;
  }

  private buildTombstonePhone(userId: number): string {
    return `deleted-${userId}`;
  }

  private async deleteFirebaseUserSafe(uid: string): Promise<void> {
    try {
      await this.firebaseAuthService.deleteFirebaseUser(uid);
    } catch (error) {
      this.logger.warn(`Firebase user deletion failed for uid ${uid}: ${error.message}`);
    }
  }
}
