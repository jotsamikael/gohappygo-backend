import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { TransactionEntity } from './transaction.entity';
import { TransactionService } from './transaction.service';
import { StripeService } from 'src/stripe/stripe.service';
import { EmailService } from 'src/email/email.service';
import { EmailTemplatesService } from 'src/email/email-templates.service';
import { PlatformPricingService } from 'src/platform-pricing/platform-pricing.service';
import { UserEntity } from 'src/user/user.entity';
import { CommonService } from 'src/common/service/common.service';

@Injectable()
export class TransactionSchedulerService {
  private readonly logger = new Logger(TransactionSchedulerService.name);

  constructor(
    @InjectRepository(TransactionEntity)
    private transactionRepository: Repository<TransactionEntity>,
    private transactionService: TransactionService,
    private stripeService: StripeService,
    private emailService: EmailService,
    private emailTemplatesService: EmailTemplatesService,
    private platformPricingService: PlatformPricingService,
    private configService: ConfigService,
    private commonService: CommonService,
  ) {
    // EventEmitter2 is available globally via EventsModule
  }

  /**
   * Process pending fund releases for transactions in awaiting_available_funds or awaiting_transfer status
   * Runs every 2 hours by default (configurable via FUND_RELEASE_CRON_INTERVAL env var)
   * Processes transactions in FIFO order (oldest first)
   */
  @Cron(process.env.FUND_RELEASE_CRON_INTERVAL || CronExpression.EVERY_6_HOURS)
  async processPendingFundReleases(): Promise<void> {
    this.logger.log('Starting scheduled fund release processing...');

    try {
      // Find all transactions that need fund release
      // Status: awaiting_available_funds OR awaiting_transfer
      // Condition: stripeTransferId is null (transfer not yet created)
      // Order: oldest first (FIFO)
      const pendingTransactions = await this.transactionRepository.find({
        where: [
          { status: 'awaiting_available_funds', stripeTransferId: IsNull() },
          { status: 'awaiting_transfer', stripeTransferId: IsNull() },
        ],
        order: { createdAt: 'ASC' }, // FIFO: oldest first
        relations: ['payee', 'request'],
      });

      if (pendingTransactions.length === 0) {
        this.logger.log('No pending transactions found for fund release');
        return;
      }

      this.logger.log(`Found ${pendingTransactions.length} pending transaction(s) to process`);

      let processedCount = 0;
      let successCount = 0;
      let failureCount = 0;

      // Get platform balance once for all awaiting_available_funds transactions
      let platformBalance: { available: number; pending: number; currency: string } | null = null;
      try {
        platformBalance = await this.stripeService.getPlatformBalance();
        this.logger.log(`Platform balance: ${platformBalance.available} ${platformBalance.currency.toUpperCase()} available, ${platformBalance.pending} pending`);
      } catch (error) {
        this.logger.warn(`Could not retrieve platform balance: ${error.message}. Will attempt transfers anyway.`);
      }

      // Process each transaction
      for (const transaction of pendingTransactions) {
        try {
          processedCount++;

          // For awaiting_available_funds, check if balance is sufficient
          if (transaction.status === 'awaiting_available_funds' && platformBalance) {
            // Calculate transfer amount
            let transferAmountUSD: number;
            if (transaction.travelerPayment !== null && transaction.travelerPayment !== undefined) {
              transferAmountUSD = await this.stripeService.convertToUSD(
                transaction.travelerPayment,
                transaction.currencyCode || 'USD'
              );
            } else {
              // Fallback calculation
              const fee = await this.platformPricingService.calculateFee(
                transaction.originalAmount || transaction.amount
              );
              const tvaAmount = (20 / 100) * fee;
              const travelerPayment = (transaction.originalAmount || transaction.amount) - fee - tvaAmount;
              transferAmountUSD = await this.stripeService.convertToUSD(
                travelerPayment,
                transaction.currencyCode || 'USD'
              );
            }

            const transferAmountCents = Math.round(transferAmountUSD * 100);
            const availableCents = Math.round(platformBalance.available * 100);

            if (availableCents < transferAmountCents) {
              this.logger.warn(
                `Transaction ${transaction.id}: Insufficient balance. Available: ${platformBalance.available} ${platformBalance.currency.toUpperCase()}, Required: ${transferAmountUSD} USD. Skipping.`
              );
              failureCount++;
              continue; // Skip to next transaction
            }
          }

          // Attempt to release funds using internal method
          // This will handle both awaiting_available_funds and awaiting_transfer
          await this.transactionService.releaseFundsForTransaction(transaction.id);

          // If we get here, transfer was successful
          successCount++;
          this.logger.log(`Successfully released funds for transaction ${transaction.id}`);

          // Send notification email to payee
          if (transaction.payee) {
            try {
              await this.sendFundReleaseNotification(transaction);
            } catch (emailError) {
              this.logger.warn(`Failed to send notification email for transaction ${transaction.id}: ${emailError.message}`);
              // Don't fail the whole process if email fails
            }
          }
        } catch (error) {
          failureCount++;
          this.logger.error(
            `Failed to process transaction ${transaction.id}: ${error.message}`,
            error.stack
          );
          // Continue processing other transactions even if one fails
        }
      }

      this.logger.log(
        `Fund release processing completed. Processed: ${processedCount}, Success: ${successCount}, Failed: ${failureCount}`
      );
    } catch (error) {
      this.logger.error(`Error in scheduled fund release processing: ${error.message}`, error.stack);
    }
  }

  /**
   * Send email notification to payee when funds are released
   */
  private async sendFundReleaseNotification(transaction: TransactionEntity): Promise<void> {
    if (!transaction.payee) {
      this.logger.warn(`Transaction ${transaction.id} has no payee, skipping notification`);
      return;
    }

    const payee = transaction.payee as UserEntity;
    const userName = this.commonService.userGreetingName(payee, 'User');
    const userEmail = payee.email;

    // Get updated transaction with transfer ID
    const updatedTransaction = await this.transactionRepository.findOne({
      where: { id: transaction.id },
    });

    if (!updatedTransaction || !updatedTransaction.stripeTransferId) {
      this.logger.warn(`Transaction ${transaction.id} does not have transfer ID, skipping notification`);
      return;
    }

    // Calculate amount for display
    let displayAmount: number;
    if (transaction.travelerPayment !== null && transaction.travelerPayment !== undefined) {
      displayAmount = Number(transaction.travelerPayment);
    } else {
      const fee = await this.platformPricingService.calculateFee(
        transaction.originalAmount || transaction.amount
      );
      const tvaAmount = (20 / 100) * fee;
      displayAmount = (transaction.originalAmount || transaction.amount) - fee - tvaAmount;
    }

    const emailTemplate = this.emailTemplatesService.getFundReleasedTemplate(
      userName,
      {
        transactionId: transaction.id,
        amount: displayAmount,
        currency: transaction.currencyCode || 'USD',
        transferId: updatedTransaction.stripeTransferId,
        requestId: transaction.requestId,
      }
    );

    await this.emailService.sendEmail({
      to: userEmail,
      subject: 'Funds Released - GoHappyGo',
      html: emailTemplate,
    });

    this.logger.log(`Fund release notification sent to ${userEmail} for transaction ${transaction.id}`);
  }

  /**
   * Optional: Listen for balance.available webhook events to trigger fund release processing
   * This provides faster response when balance updates (optimization)
   * Note: Stripe may not send balance.available events in all regions
   */
  @OnEvent('stripe.balance.available')
  async handleBalanceAvailable(balanceData: any): Promise<void> {
    this.logger.log('Balance available webhook received, triggering fund release processing');
    // Trigger the same processing logic as cron job
    // Use setImmediate to avoid blocking the webhook handler
    setImmediate(() => {
      this.processPendingFundReleases().catch(error => {
        this.logger.error(`Error processing fund releases from webhook: ${error.message}`, error.stack);
      });
    });
  }
}
