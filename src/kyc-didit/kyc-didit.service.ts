import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { UserEntity } from '../user/user.entity';
import { UserEventsService } from '../events/user-events.service';
import { KycClient } from './dto/start-kyc-query.dto';
import { resolveKycReturnUrl } from './kyc-return-urls.util';
import { CustomBadRequestException } from '../common/exception/custom-exceptions';
import { ErrorCode } from '../common/exception/error-codes';
import { verifyDiditWebhookSignature } from './didit-webhook.util';

export type KycStatus =
  | 'uninitiated'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'failed';

export interface KycStatusResult {
  kycStatus: KycStatus;
  kycUpdatedAt: Date | null;
  kycProvider: string | null;
  isVerified: boolean;
  wasUpdated: boolean;
}

@Injectable()
export class KycDiditService {
  private readonly logger = new Logger(KycDiditService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpService,
    @InjectRepository(UserEntity) private users: Repository<UserEntity>,
    private readonly userEventsService: UserEventsService,
  ) {}

  private get apiKey(): string {
    return this.configService.get<string>('DIDIT_API_KEY') || '';
  }

  private get baseUrl(): string {
    return (
      this.configService.get<string>('DIDIT_BASE_URL') ||
      'https://verification.didit.me'
    );
  }

  private get webhookSecret(): string {
    return this.configService.get<string>('DIDIT_WEBHOOK_SECRET_KEY') || '';
  }

  private get workflowId(): string {
    return this.configService.get<string>('DIDIT_WORKFLOW_ID') || '';
  }

  /**
   * Placeholders (email_${uuid}, social_${firebaseUid}, deleted-*) are unique NOT NULL
   * sentinels, not E.164 numbers. Didit rejects phone values over 20 characters.
   */
  private isDiditSafePhone(phone?: string | null): boolean {
    if (!phone) {
      return false;
    }
    const trimmed = phone.trim();
    if (trimmed.length === 0 || trimmed.length > 20) {
      return false;
    }
    if (
      trimmed.startsWith('email_') ||
      trimmed.startsWith('social_') ||
      trimmed.startsWith('deleted-')
    ) {
      return false;
    }
    return /^\+?[0-9][0-9\s.-]{5,19}$/.test(trimmed);
  }

  /**
   * Map Didit status strings to internal KYC status.
   */
  mapDiditStatus(raw: string): Exclude<KycStatus, 'uninitiated'> {
    const status = (raw || '').toLowerCase().replace(/_/g, ' ').trim();
    switch (status) {
      case 'approved':
        return 'approved';
      case 'rejected':
      case 'declined':
        return 'rejected';
      case 'failed':
      case 'abandoned':
      case 'expired':
      case 'kyc expired':
        return 'failed';
      case 'in review':
        return 'in_review';
      case 'pending':
      case 'not started':
      case 'in progress':
      case 'awaiting user':
      case 'resubmitted':
        return 'pending';
      default:
        return 'failed';
    }
  }

  /**
   * START KYC PROCESS - Creates a new verification session with Didit
   */
  async start(user: UserEntity, client: KycClient = KycClient.WEB) {
    this.logger.log(
      `Starting KYC process for user ${user.id} (${user.email}), client=${client}`,
    );

    if (!this.isDiditSafePhone(user.phone)) {
      throw new CustomBadRequestException(
        'Update your account with a valid phone number before starting identity verification',
        ErrorCode.KYC_VALID_PHONE_REQUIRED,
      );
    }

    if (user.isVerified || user.kycStatus === 'approved') {
      throw new BadRequestException('User is already verified');
    }

    const canReuseSession =
      (user.kycStatus === 'pending' || user.kycStatus === 'in_review') &&
      !!user.kycReference;

    if (canReuseSession) {
      const resumed = await this.tryResumePendingSession(user, client);
      if (resumed) {
        return resumed;
      }
      if (user.kycStatus === 'in_review') {
        throw new CustomBadRequestException(
          'Your identity verification is under review. You will be notified when it is approved or rejected.',
          ErrorCode.KYC_UNDER_REVIEW,
        );
      }
      this.logger.warn(
        `Pending Didit session ${user.kycReference} is not resumable for user ${user.id}; creating a new session`,
      );
    }

    return this.createDiditSession(user, client);
  }

  /**
   * Resume an in-progress Didit session. Returns null when the session is
   * gone (404) or has no hosted URL so the caller can create a new one.
   */
  private async tryResumePendingSession(
    user: UserEntity,
    client: KycClient,
  ): Promise<{
    redirectUrl: string;
    sessionId: string | null | undefined;
    message: string;
  } | null> {
    this.logger.log(
      `Resuming pending KYC session ${user.kycReference} for user ${user.id}`,
    );

    try {
      const session = await this.fetchDiditSession(user.kycReference!);
      const rawStatus = this.extractDiditStatus(session);
      const mapped = this.mapDiditStatus(rawStatus);

      if (mapped === 'approved') {
        await this.syncUserFromDiditStatus(user, rawStatus, user.kycReference!);
        return {
          redirectUrl: resolveKycReturnUrl(this.configService, client),
          sessionId: user.kycReference,
          message: 'KYC is already approved.',
        };
      }

      if (mapped === 'in_review') {
        await this.syncUserFromDiditStatus(user, rawStatus, user.kycReference!);
        throw new CustomBadRequestException(
          'Your identity verification is under review. You will be notified when it is approved or rejected.',
          ErrorCode.KYC_UNDER_REVIEW,
        );
      }

      if (mapped !== 'pending') {
        this.logger.warn(
          `Didit session ${user.kycReference} status=${rawStatus} is not resumable for user ${user.id}`,
        );
        return null;
      }

      const redirectUrl = session?.url;
      if (!redirectUrl) {
        this.logger.warn(
          `Didit session ${user.kycReference} has no url for user ${user.id}`,
        );
        return null;
      }

      return {
        redirectUrl,
        sessionId: user.kycReference,
        message: 'Existing KYC session resumed. Redirect user to complete verification.',
      };
    } catch (error) {
      if (
        error instanceof CustomBadRequestException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const status = error?.response?.status;
      this.logger.error(
        `Failed to resume Didit session ${user.kycReference} for user ${user.id}: ${error.message}`,
      );
      this.logger.error(
        `Error response: ${JSON.stringify(error.response?.data)}`,
      );

      if (status === 401 || status === 403) {
        throw new BadRequestException('Invalid Didit API credentials');
      }
      if (status === 404) {
        return null;
      }
      throw new BadRequestException(
        'Failed to resume KYC session. Please try again later.',
      );
    }
  }

  private async createDiditSession(user: UserEntity, client: KycClient) {
    const returnUrl = resolveKycReturnUrl(this.configService, client);

    const contactDetails: Record<string, string> = {
      email: user.email,
      email_lang: 'en',
    };
    if (this.isDiditSafePhone(user.phone)) {
      contactDetails.phone = user.phone.trim();
    }

    const payload = {
      workflow_id: this.workflowId,
      vendor_data: user.id.toString(),
      callback: returnUrl,
      metadata: {
        user_email: user.email,
        user_name: `${user.firstName} ${user.lastName}`,
        platform: client,
      },
      contact_details: contactDetails,
    };

    try {
      this.logger.log(
        `Creating Didit session for user ${user.id}, callback=${returnUrl}`,
      );

      const resp = await firstValueFrom(
        this.http.post(`${this.baseUrl}/v3/session/`, payload, {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }),
      );

      const verificationId = resp.data?.session_id;
      const redirectUrl = resp.data?.url;

      if (!verificationId || !redirectUrl) {
        this.logger.error(
          `Invalid response from Didit API: ${JSON.stringify(resp.data)}`,
        );
        throw new BadRequestException('Failed to start KYC with provider');
      }

      this.logger.log(`Didit session created successfully: ${verificationId}`);

      await this.users.update(user.id, {
        kycProvider: 'didit',
        kycReference: verificationId,
        kycStatus: 'pending',
        kycUpdatedAt: new Date(),
      });

      this.userEventsService.emitKycStarted(
        user,
        verificationId,
        redirectUrl,
        'didit',
      );

      return {
        redirectUrl,
        sessionId: verificationId,
        message:
          'KYC session created successfully. Redirect user to complete verification.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to create Didit session for user ${user.id}: ${error.message}`,
      );
      this.logger.error(
        `Error response: ${JSON.stringify(error.response?.data)}`,
      );

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new BadRequestException('Invalid Didit API credentials');
      }
      if (error.response?.status === 400) {
        const diditBody = error.response.data;
        const diditMessage =
          diditBody?.detail ||
          diditBody?.message ||
          (diditBody ? JSON.stringify(diditBody) : 'Unknown error');
        throw new BadRequestException(`Invalid request to Didit: ${diditMessage}`);
      }
      throw new BadRequestException(
        'Failed to start KYC process. Please try again later.',
      );
    }
  }

  private async fetchDiditSession(sessionId: string): Promise<any> {
    const headers = { 'x-api-key': this.apiKey };
    try {
      const resp = await firstValueFrom(
        this.http.get(`${this.baseUrl}/v3/session/${sessionId}/`, { headers }),
      );
      return resp.data;
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
      const decision = await firstValueFrom(
        this.http.get(`${this.baseUrl}/v3/session/${sessionId}/decision/`, {
          headers,
        }),
      );
      return decision.data;
    }
  }

  private extractDiditStatus(session: any): string {
    return (
      session?.status ||
      session?.verification_status ||
      session?.decision?.status ||
      ''
    );
  }

  /**
   * Sync user KYC fields from a Didit status string.
   */
  private async syncUserFromDiditStatus(
    user: UserEntity,
    rawStatus: string,
    verificationId: string,
    reason?: string,
  ): Promise<boolean> {
    const finalStatus = this.mapDiditStatus(rawStatus);
    const previousStatus = user.kycStatus;
    const alreadyApproved = user.isVerified || previousStatus === 'approved';

    if (
      alreadyApproved &&
      finalStatus !== 'approved' &&
      finalStatus !== 'rejected' &&
      finalStatus !== 'failed'
    ) {
      this.logger.log(
        `[syncUserFromDiditStatus] User ${user.id} already approved; ignoring Didit status '${rawStatus}'`,
      );
      return false;
    }

    const needsUpdate =
      previousStatus !== finalStatus ||
      (finalStatus === 'approved' && !user.isVerified) ||
      (finalStatus === 'approved' && user.kycReference !== verificationId);

    if (!needsUpdate) {
      this.logger.log(
        `[syncUserFromDiditStatus] User ${user.id} already in sync: '${previousStatus}'`,
      );
      return false;
    }

    const isVerified =
      finalStatus === 'approved' ||
      (alreadyApproved && finalStatus !== 'rejected' && finalStatus !== 'failed');

    await this.users.update(user.id, {
      kycStatus: isVerified ? 'approved' : finalStatus,
      isVerified,
      kycProvider: 'didit',
      kycReference: verificationId,
      kycUpdatedAt: new Date(),
    });

    this.logger.log(
      `[syncUserFromDiditStatus] User ${user.id} KYC status updated from '${previousStatus}' to '${finalStatus}'`,
    );

    if (
      finalStatus !== previousStatus &&
      ['approved', 'rejected', 'failed'].includes(finalStatus)
    ) {
      this.userEventsService.emitKycCompleted(
        user,
        verificationId,
        finalStatus as 'approved' | 'rejected' | 'failed',
        'didit',
        reason,
      );
    }

    return true;
  }

  async handleWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ) {
    this.logger.log('Received webhook from Didit');

    let event: Record<string, any>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const verified = verifyDiditWebhookSignature(
      rawBody,
      event,
      headers,
      this.webhookSecret,
    );
    if (!verified) {
      this.logger.error('Invalid or missing Didit webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log(`Webhook signature verified successfully (${verified})`);
    this.logger.log(`Processing webhook event: ${JSON.stringify(event)}`);

    const webhookType = event.webhook_type || '';
    if (
      webhookType &&
      webhookType !== 'status.updated' &&
      webhookType !== 'data.updated'
    ) {
      this.logger.log(`Ignoring Didit webhook type ${webhookType}`);
      return;
    }

    const verificationId =
      event.session_id || event.verification_id || event.id;
    let status = event.status || '';

    if (!verificationId) {
      this.logger.error('Webhook missing verification ID');
      return;
    }

    if (verified === 'simple' || !status) {
      try {
        const session = await this.fetchDiditSession(verificationId);
        status = this.extractDiditStatus(session) || status;
      } catch (error) {
        this.logger.warn(
          `Could not re-fetch Didit session ${verificationId}: ${error.message}`,
        );
      }
    }

    if (!status) {
      this.logger.error(`Webhook missing status for session ${verificationId}`);
      return;
    }

    const user = await this.findUserForDiditSession(
      verificationId,
      event.vendor_data || event.decision?.vendor_data,
    );
    if (!user) {
      this.logger.warn(`No user found for verification ID: ${verificationId}`);
      return;
    }

    await this.syncUserFromDiditStatus(
      user,
      status,
      verificationId,
      event.reason,
    );
  }

  private async findUserForDiditSession(
    sessionId: string,
    vendorData?: string,
  ): Promise<UserEntity | null> {
    const byReference = await this.users.findOne({
      where: { kycReference: sessionId },
    });
    if (byReference) {
      return byReference;
    }

    const vendorId = Number.parseInt(String(vendorData || ''), 10);
    if (!Number.isInteger(vendorId) || vendorId <= 0) {
      return null;
    }

    return this.users.findOne({ where: { id: vendorId } });
  }

  /**
   * Pull-sync KYC status from Didit into the database.
   */
  async syncKycStatus(userId: number): Promise<KycStatusResult> {
    this.logger.log(`[syncKycStatus] Syncing KYC status for user ${userId}`);

    const user = await this.users.findOne({ where: { id: userId } });

    if (!user) {
      this.logger.warn(`User ${userId} not found`);
      return {
        kycStatus: 'uninitiated',
        kycUpdatedAt: null,
        kycProvider: null,
        isVerified: false,
        wasUpdated: false,
      };
    }

    if (!user.kycReference) {
      return {
        kycStatus: (user.kycStatus as KycStatus) || 'uninitiated',
        kycUpdatedAt: user.kycUpdatedAt || null,
        kycProvider: user.kycProvider || null,
        isVerified: user.isVerified || false,
        wasUpdated: false,
      };
    }

    try {
      const session = await this.fetchDiditSession(user.kycReference);
      const rawStatus = this.extractDiditStatus(session);
      const wasUpdated = await this.syncUserFromDiditStatus(
        user,
        rawStatus,
        user.kycReference,
      );

      const updatedUser = await this.users.findOne({ where: { id: userId } });

      return {
        kycStatus: (updatedUser?.kycStatus as KycStatus) || 'uninitiated',
        kycUpdatedAt: updatedUser?.kycUpdatedAt || null,
        kycProvider: updatedUser?.kycProvider || null,
        isVerified: updatedUser?.isVerified || false,
        wasUpdated,
      };
    } catch (error) {
      this.logger.error(
        `[syncKycStatus] Failed to fetch Didit session for user ${userId}: ${error.message}`,
      );

      return {
        kycStatus: (user.kycStatus as KycStatus) || 'uninitiated',
        kycUpdatedAt: user.kycUpdatedAt || null,
        kycProvider: user.kycProvider || null,
        isVerified: user.isVerified || false,
        wasUpdated: false,
      };
    }
  }

  async getSessionDetails(userId: number) {
    const user = await this.users.findOne({ where: { id: userId } });

    if (!user || !user.kycReference) {
      return { message: 'No active KYC session found' };
    }

    try {
      const diditDetails = await this.fetchDiditSession(user.kycReference);

      return {
        sessionId: user.kycReference,
        status: user.kycStatus,
        provider: user.kycProvider,
        updatedAt: user.kycUpdatedAt,
        diditDetails,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch session details: ${error.message}`);
      return {
        sessionId: user.kycReference,
        status: user.kycStatus,
        provider: user.kycProvider,
        updatedAt: user.kycUpdatedAt,
        error: 'Could not fetch additional details from Didit',
      };
    }
  }
}
