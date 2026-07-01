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
import * as crypto from 'crypto';
import { KycClient } from './dto/start-kyc-query.dto';
import { resolveKycReturnUrl } from './kyc-return-urls.util';

export type KycStatus =
  | 'uninitiated'
  | 'pending'
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

  private get webhookCallbackUrl(): string {
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') || 'http://localhost:3000';
    return `${backendUrl.replace(/\/$/, '')}/api/kyc/webhook`;
  }

  /**
   * Map Didit status strings to internal KYC status.
   */
  mapDiditStatus(raw: string): Exclude<KycStatus, 'uninitiated'> {
    const status = (raw || '').toLowerCase();
    switch (status) {
      case 'approved':
        return 'approved';
      case 'rejected':
        return 'rejected';
      case 'failed':
        return 'failed';
      case 'pending':
      case 'in review':
      case 'in_review':
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

    if (user.kycStatus === 'pending' && user.kycReference) {
      return this.resumePendingSession(user);
    }

    const returnUrl = resolveKycReturnUrl(this.configService, client);

    const payload = {
      workflow_id: this.workflowId,
      vendor_data: user.id.toString(),
      callback: this.webhookCallbackUrl,
      return_url: returnUrl,
      metadata: {
        user_email: user.email,
        user_name: `${user.firstName} ${user.lastName}`,
        platform: client,
      },
      contact_details: {
        email: user.email,
        email_lang: 'en',
        phone: user.phone,
      },
    };

    try {
      this.logger.log(
        `Creating Didit session for user ${user.id}, return_url=${returnUrl}`,
      );

      const resp = await firstValueFrom(
        this.http.post(`${this.baseUrl}/v2/session/`, payload, {
          headers: {
            'X-Api-Key': this.apiKey,
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

      if (error.response?.status === 401) {
        throw new BadRequestException('Invalid Didit API credentials');
      }
      if (error.response?.status === 400) {
        throw new BadRequestException(
          `Invalid request to Didit: ${error.response.data?.message || 'Unknown error'}`,
        );
      }
      throw new BadRequestException(
        'Failed to start KYC process. Please try again later.',
      );
    }
  }

  /**
   * Resume an in-progress Didit session instead of creating a new one.
   */
  private async resumePendingSession(user: UserEntity) {
    this.logger.log(
      `Resuming pending KYC session ${user.kycReference} for user ${user.id}`,
    );

    const session = await this.fetchDiditSession(user.kycReference!);
    const redirectUrl = session?.url;

    if (!redirectUrl) {
      throw new BadRequestException(
        'KYC verification is already in progress but session URL is unavailable',
      );
    }

    return {
      redirectUrl,
      sessionId: user.kycReference,
      message: 'Existing KYC session resumed. Redirect user to complete verification.',
    };
  }

  private async fetchDiditSession(sessionId: string): Promise<any> {
    const resp = await firstValueFrom(
      this.http.get(`${this.baseUrl}/v2/session/${sessionId}`, {
        headers: {
          'X-Api-Key': this.apiKey,
        },
      }),
    );
    return resp.data;
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
    const needsUpdate =
      previousStatus !== finalStatus ||
      (finalStatus === 'approved' && !user.isVerified);

    if (!needsUpdate) {
      this.logger.log(
        `[syncUserFromDiditStatus] User ${user.id} already in sync: '${previousStatus}'`,
      );
      return false;
    }

    await this.users.update(user.id, {
      kycStatus: finalStatus,
      isVerified: finalStatus === 'approved',
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

  verifyWebhookSignature(rawBody: string, signature: string) {
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(rawBody, 'utf8');
    const digest = hmac.digest('hex');

    if (digest !== signature) {
      this.logger.error('Invalid webhook signature received');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log('Webhook signature verified successfully');
  }

  async handleWebhook(rawBody: string, signature: string) {
    this.logger.log('Received webhook from Didit');

    this.verifyWebhookSignature(rawBody, signature);

    const event = JSON.parse(rawBody);
    this.logger.log(`Processing webhook event: ${JSON.stringify(event)}`);

    const verificationId =
      event.session_id || event.verification_id || event.id;
    const status = event.status || '';

    if (!verificationId) {
      this.logger.error('Webhook missing verification ID');
      return;
    }

    const user = await this.users.findOne({
      where: { kycReference: verificationId },
    });
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
      const rawStatus = session?.status || session?.verification_status || '';
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
