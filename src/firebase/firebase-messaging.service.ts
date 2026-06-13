import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { FirebaseConfig } from './firebase.config';

export interface FcmSendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

@Injectable()
export class FirebaseMessagingService {
  private readonly logger = new Logger(FirebaseMessagingService.name);

  constructor(
    private readonly firebaseConfig: FirebaseConfig,
    private readonly configService: ConfigService,
  ) {}

  isEnabled(): boolean {
    return this.configService.get<string>('FCM_ENABLED') === 'true';
  }

  async sendToTokens(
    tokens: string[],
    message: Omit<admin.messaging.MulticastMessage, 'tokens'>,
  ): Promise<FcmSendResult> {
    if (!this.isEnabled()) {
      this.logger.debug('FCM send skipped (FCM_ENABLED is not true)');
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const messaging = this.firebaseConfig.getMessaging();
    const invalidTokens: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    const batchSize = 500;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batchTokens = tokens.slice(i, i + batchSize);

      try {
        const response = await messaging.sendEachForMulticast({
          ...message,
          tokens: batchTokens,
        });

        successCount += response.successCount;
        failureCount += response.failureCount;

        response.responses.forEach((result, index) => {
          if (result.success) {
            return;
          }

          const token = batchTokens[index];
          const errorCode = result.error?.code;

          if (errorCode && INVALID_TOKEN_ERROR_CODES.has(errorCode)) {
            invalidTokens.push(token);
            this.logger.warn(`Invalid FCM token removed from future sends: ${errorCode}`);
          } else {
            this.logger.error(
              `FCM send failed for token index ${index}: ${result.error?.message ?? 'unknown error'}`,
            );
          }
        });
      } catch (error) {
        failureCount += batchTokens.length;
        this.logger.error(`FCM multicast batch failed: ${error.message}`, error.stack);
      }
    }

    return { successCount, failureCount, invalidTokens };
  }
}
