import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { UserEntity } from 'src/user/user.entity';
import { UserService } from 'src/user/user.service';
import { CurrencyService } from 'src/currency/currency.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeWebhookEventEntity } from './entities/stripe-webhook-event.entity';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private currencyService: CurrencyService,
    @InjectRepository(StripeWebhookEventEntity)
    private webhookEventRepository: Repository<StripeWebhookEventEntity>,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not found in environment variables');
    }
    this.stripe = new Stripe(secretKey || '', {
      apiVersion: '2025-12-15.clover',
    });
  }

  /**
   * Create a Stripe Connect Custom account for a user (deferred onboarding)
   * @param user - User entity
   * @param countryCode - ISO 3166-1 alpha-2 country code (must be Stripe Connect eligible)
   * @param ipAddress - User's IP address (defaults to '127.0.0.1' if not provided)
   */
  async createConnectAccount(user: UserEntity, countryCode: string, ipAddress: string = '127.0.0.1'): Promise<Stripe.Account> {
    try {
      // For French platforms (and some other countries), Stripe requires using Account Tokens
      // Create account token with business_type and individual information
      // Note: business_profile cannot be set in account token, must be set on account after creation
      const accountToken = await this.stripe.tokens.create({
        account: {
          tos_shown_and_accepted: true,
          business_type: 'individual', // Must be in the token, not in account creation
          individual: {
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            phone: user.phone,
          },
        },
      });
  
      // Use the account token to create the account
      const account = await this.stripe.accounts.create({
        type: 'custom',
        country: countryCode.toUpperCase(),
        email: user.email,
        account_token: accountToken.id,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
  
      // Update business_profile after account creation (cannot be set in account token)
      await this.stripe.accounts.update(account.id, {
        business_profile: {
          url: this.configService.get<string>('FRONTEND_URL') || 'https://gohappygo.netlify.app',
          mcc: '4215', // MCC code for Courier Services (shipping/forwarding)
          // Alternative MCC codes:
          // '4789' - Transportation Services - Not Elsewhere Classified
          // '4722' - Travel Agencies and Tour Operators
        },
      });
  
      // Update user with Stripe account ID
      user.stripeAccountId = account.id;
      user.stripeAccountStatus = 'pending';
      await this.userService.save(user);
  
      return account;
    } catch (error) {
      this.logger.error(`Error creating Stripe Connect account: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create Stripe account: ${error.message}`);
    }
  }

  /**
   * Create an Account Link for onboarding
   */
  async createAccountLink(accountId: string): Promise<string> {
    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://gohappygo.netlify.app';
      
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${frontendUrl}/settings/payments?refresh=true`,
        return_url: `${frontendUrl}/settings/payments?success=true`,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      this.logger.error(`Error creating Account Link: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create Account Link: ${error.message}`);
    }
  }

  /**
   * Get account status
   */
  async getAccountStatus(accountId: string): Promise<{
    status: 'uninitiated' | 'pending' | 'active' | 'restricted';
    chargesEnabled: boolean;
    transfersEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);

      let status: 'uninitiated' | 'pending' | 'active' | 'restricted' = 'pending';
      const chargesEnabled = account.charges_enabled || false;
      const detailsSubmitted = account.details_submitted || false;
      
      // Check if account has transfer capabilities
      const hasTransferCapability = account.capabilities?.transfers === 'active';
      
      if (chargesEnabled && hasTransferCapability) {
        status = 'active';
      } else if (detailsSubmitted) {
        status = 'pending';
      } else if (chargesEnabled === false && detailsSubmitted) {
        status = 'restricted';
      }

      return {
        status,
        chargesEnabled,
        transfersEnabled: hasTransferCapability || false,
        detailsSubmitted,
      };
    } catch (error) {
      this.logger.error(`Error retrieving account status: ${error.message}`, error.stack);
      throw new NotFoundException(`Failed to retrieve account status: ${error.message}`);
    }
  }

  /**
   * Convert amount to USD using currency exchangeRate
   */
  async convertToUSD(amount: number, fromCurrency: string): Promise<number> {
    return this.currencyService.convertToUSD(amount, fromCurrency);
  }

  /**
   * Create Payment Intent with escrow model (funds held on platform account)
   * @param amountUSD - Amount in USD (in dollars, will be converted to cents)
   * @param paymentMethodId - Stripe Payment Method ID
   * @param platformFeeUSD - Platform fee in USD (in dollars, will be converted to cents)
   * @param metadata - Additional metadata to attach
   */
  async createPaymentIntent(
    amountUSD: number,
    paymentMethodId: string,
    platformFeeUSD: number,
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    try {
      // Convert dollars to cents (Stripe requires amounts in smallest currency unit)
      const amountInCents = Math.round(amountUSD * 100);
  
      // Create Payment Intent without confirming
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        payment_method: paymentMethodId,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never', // Disable redirect-based payment methods
        },
        metadata: {
          ...metadata,
          platform: 'gohappygo',
        },
        // No application_fee_amount - funds stay on platform account (escrow model)
        // Platform fee is calculated separately and stays on platform when we transfer
      });

      // Confirm asynchronously (don't await - let it process in background)
      // The webhook will handle the success/failure
      this.stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: paymentMethodId,
      }).catch(error => {
        this.logger.error(`Error confirming Payment Intent ${paymentIntent.id}: ${error.message}`, error.stack);
      });
  
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Error creating Payment Intent: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create Payment Intent: ${error.message}`);
    }
  }

  /**
   * Create Transfer to connected account (release escrow funds)
   * @param amountUSD - Amount in USD (in dollars, will be converted to cents)
   * @param destinationAccountId - Stripe Connect account ID
   * @param sourceTransactionId - Charge ID from the original Payment Intent
   */
  async createTransfer(
    amountUSD: number,
    destinationAccountId: string,
    sourceTransactionId: string,
  ): Promise<Stripe.Transfer> {
    try {
      // Retrieve the charge to get balance transaction ID
      const charge = await this.stripe.charges.retrieve(sourceTransactionId);
      const chargeCurrency = charge.currency.toLowerCase();
      
      this.logger.log(`Charge currency: ${chargeCurrency}, Charge amount: ${charge.amount / 100} ${charge.currency.toUpperCase()}`);
  
      // Retrieve the balance transaction to get its currency
      // The transfer currency MUST match the balance transaction currency, not the charge currency
      // This is important for French platforms where balance transactions may be in EUR even if charge is in USD
      const balanceTransactionId = charge.balance_transaction as string;
      if (!balanceTransactionId) {
        throw new BadRequestException('Charge has no associated balance transaction');
      }
      
      const balanceTransaction = await this.stripe.balanceTransactions.retrieve(balanceTransactionId);
      const balanceTransactionCurrency = balanceTransaction.currency.toLowerCase(); // This is what matters for transfers
      
      this.logger.log(`Balance transaction currency: ${balanceTransactionCurrency}, Balance transaction amount: ${balanceTransaction.amount / 100} ${balanceTransaction.currency.toUpperCase()}`);
  
      // Retrieve the Payment Intent to get the original amount and calculate conversion ratio
      const paymentIntentId = charge.payment_intent as string;
      if (!paymentIntentId) {
        throw new BadRequestException('Charge has no associated Payment Intent');
      }
      
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      const paymentIntentAmount = paymentIntent.amount; // Original amount in cents
      const paymentIntentCurrency = paymentIntent.currency.toLowerCase();
      
      this.logger.log(`Payment Intent currency: ${paymentIntentCurrency}, Payment Intent amount: ${paymentIntentAmount / 100} ${paymentIntent.currency.toUpperCase()}`);
  
      // Calculate transfer amount based on balance transaction currency (not charge currency)
      let transferAmount: number;
      if (balanceTransactionCurrency === 'usd') {
        // Balance transaction is in USD, use amountUSD directly
        transferAmount = Math.round(amountUSD * 100); // Convert to cents
        this.logger.log(`Transfer in USD: ${transferAmount / 100} USD`);
      } else {
        // Balance transaction is in a different currency (e.g., EUR)
        // Calculate the conversion ratio: balanceTransaction.amount / paymentIntentAmount
        // This ratio represents how much the currency was converted
        const conversionRatio = balanceTransaction.amount / paymentIntentAmount;
        
        // Apply the same conversion ratio to our USD amount
        const amountInCents = Math.round(amountUSD * 100);
        transferAmount = Math.round(amountInCents * conversionRatio);
        
        this.logger.log(`Converting transfer: USD ${amountUSD} -> ${balanceTransactionCurrency.toUpperCase()} ${transferAmount / 100} (ratio: ${conversionRatio})`);
      }
  
      this.logger.log(`Creating transfer: ${transferAmount / 100} ${balanceTransactionCurrency.toUpperCase()} to account ${destinationAccountId}`);
  
      const transfer = await this.stripe.transfers.create({
        amount: transferAmount,
        currency: balanceTransactionCurrency, // MUST match balance transaction currency, not charge currency
        destination: destinationAccountId,
        source_transaction: sourceTransactionId, // Link to original charge
      });
  
      this.logger.log(`Transfer created successfully: ${transfer.id}`);
      return transfer;
    } catch (error) {
      this.logger.error(`Error creating Transfer: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create Transfer: ${error.message}`);
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    // Store webhook event for idempotency and debugging
    const existingEvent = await this.webhookEventRepository.findOne({
      where: { eventId: event.id },
    });

    if (existingEvent && existingEvent.processed) {
      this.logger.log(`Webhook event ${event.id} already processed, skipping`);
      return;
    }

    // Save or update event
    if (existingEvent) {
      existingEvent.processed = false; // Reset if reprocessing
      existingEvent.payload = JSON.stringify(event);
      await this.webhookEventRepository.save(existingEvent);
    } else {
      const webhookEvent = this.webhookEventRepository.create({
        eventId: event.id,
        eventType: event.type,
        processed: false,
        payload: JSON.stringify(event),
      });
      await this.webhookEventRepository.save(webhookEvent);
    }

    // Process event based on type
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'transfer.created':
        await this.handleTransferCreated(event.data.object as Stripe.Transfer);
        break;
      case 'transfer.updated':
        await this.handleTransferUpdated(event.data.object as Stripe.Transfer);
        break;
      case 'transfer.reversed':
        await this.handleTransferReversed(event.data.object as Stripe.Transfer);
        break;
      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        this.logger.log(`Unhandled webhook event type: ${event.type}`);
    }

    // Mark event as processed
    const eventEntity = await this.webhookEventRepository.findOne({
      where: { eventId: event.id },
    });
    if (eventEntity) {
      eventEntity.processed = true;
      await this.webhookEventRepository.save(eventEntity);
    }
  }

  /**
   * Handle payment_intent.succeeded webhook
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.log(`Payment Intent succeeded: ${paymentIntent.id}`);
    // Transaction status will be updated by the service that created it
    // This is mainly for logging and event emission
  }

  /**
   * Handle payment_intent.payment_failed webhook
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.error(`Payment Intent failed: ${paymentIntent.id}`);
    // Transaction status will be updated by the service that created it
    // Could emit event to notify user
  }

  /**
   * Handle transfer.created webhook
   */
  private async handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
    this.logger.log(`Transfer created: ${transfer.id}`);
    // Check if transfer was reversed (indicates failure)
    if (transfer.reversed) {
      this.logger.error(`Transfer reversed: ${transfer.id}`);
      // Could emit event to notify admin/user
    }
    // Transaction status will be updated by the service that created it
  }

  /**
   * Handle transfer.updated webhook
   */
  private async handleTransferUpdated(transfer: Stripe.Transfer): Promise<void> {
    this.logger.log(`Transfer updated: ${transfer.id}`);
    // Check if transfer was reversed (indicates failure)
    if (transfer.reversed) {
      this.logger.error(`Transfer reversed: ${transfer.id}`);
      // Could emit event to notify admin/user
    }
  }

  /**
   * Handle transfer.reversed webhook
   */
  private async handleTransferReversed(transfer: Stripe.Transfer): Promise<void> {
    this.logger.error(`Transfer reversed: ${transfer.id}`);
    // Could emit event to notify admin/user
  }

  /**
   * Handle account.updated webhook
   */
  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    this.logger.log(`Account updated: ${account.id}`);
    
    // Update user's Stripe account status
    const user = await this.userService.findByStripeAccountId(account.id);
    if (user) {
      const status = await this.getAccountStatus(account.id);
      user.stripeAccountStatus = status.status;
      await this.userService.save(user);
    }
  }

  /**
   * Get charge ID from Payment Intent
   */
  async getChargeIdFromPaymentIntent(paymentIntentId: string): Promise<string> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      if (!paymentIntent.latest_charge) {
        throw new NotFoundException(`Payment Intent ${paymentIntentId} has no charge`);
      }
      return paymentIntent.latest_charge as string;
    } catch (error) {
      this.logger.error(`Error retrieving Payment Intent: ${error.message}`, error.stack);
      throw new NotFoundException(`Failed to retrieve Payment Intent: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${error.message}`);
    }
  }
}

