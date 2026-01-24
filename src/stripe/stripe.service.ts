import { Injectable, BadRequestException, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { UserEntity } from 'src/user/user.entity';
import { UserService } from 'src/user/user.service';
import { CurrencyService } from 'src/currency/currency.service';
import { PlatformPricingService } from 'src/platform-pricing/platform-pricing.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { StripeWebhookEventEntity } from './entities/stripe-webhook-event.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private currencyService: CurrencyService,
    @Inject(forwardRef(() => PlatformPricingService))
    private platformPricingService: PlatformPricingService,
    @InjectRepository(StripeWebhookEventEntity)
    private webhookEventRepository: Repository<StripeWebhookEventEntity>,
    @InjectRepository(TransactionEntity)
    private transactionRepository: Repository<TransactionEntity>,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not found in environment variables');
    }
    //  apiVersion: '2025-02-24.acacia',
    this.stripe = new Stripe(secretKey || '', {
      apiVersion: '2025-12-15.clover',
    });
  }

  /**
   * Get the appropriate business type for a given country
   * Some countries (like UAE) only support 'company', not 'individual'
   */
  private getBusinessTypeForCountry(countryCode: string): 'individual' | 'company' {
    const country = countryCode.toUpperCase();
    
    // Countries that only support 'company' business type
    const companyOnlyCountries = [
      'AE', // United Arab Emirates
      'BR',// Brazil
      'HK', // Hong Kong
      'SG', // Singapore
      'MY', // Malaysia
      'TH', // Thailand
      // Add other countries as needed based on Stripe's requirements
    ];
    
    return companyOnlyCountries.includes(country) ? 'company' : 'individual';
  }

  /**
   * Create a Stripe Connect Custom account for a user (deferred onboarding)
   * @param user - User entity
   * @param countryCode - ISO 3166-1 alpha-2 country code (must be Stripe Connect eligible)
   * @param ipAddress - User's IP address (defaults to '127.0.0.1' if not provided)
   */
  async createConnectAccount(user: UserEntity, countryCode: string, ipAddress: string = '127.0.0.1'): Promise<Stripe.Account> {
    try {
      const businessType = this.getBusinessTypeForCountry(countryCode);
      
      // Build account token based on business type
      const accountTokenData: any = {
        account: {
          tos_shown_and_accepted: true,
          business_type: businessType,
        },
      };
      
      // Add appropriate fields based on business type
      if (businessType === 'individual') {
        accountTokenData.account.individual = {
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          phone: user.phone,
        };
      } else {
        // For company type, we need company information
        // Since we don't have company details at registration, we'll use individual's info
        // The user will need to update this during onboarding
        accountTokenData.account.company = {
          name: `${user.firstName} ${user.lastName}`, // Temporary, user will update during onboarding
        };
        // Also include individual as the representative
        accountTokenData.account.individual = {
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          phone: user.phone,
        };
      }
      
      // For French platforms (and some other countries), Stripe requires using Account Tokens
      // Create account token with business_type and appropriate information
      // Note: business_profile cannot be set in account token, must be set on account after creation
      const accountToken = await this.stripe.tokens.create(accountTokenData);
  
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
        return_url: `${frontendUrl}/stripe-onboarding`, 
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      this.logger.error(`Error creating Account Link: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create Account Link: ${error.message}`);
    }
  }

  /**
   * Get account balance (available and pending)
   */
  async getAccountBalance(accountId: string): Promise<Stripe.Balance> {
    try {
      const balance = await this.stripe.balance.retrieve({
        stripeAccount: accountId,
      });
      console.log(`Balance:`);
      console.log(balance);

      return balance;
    } catch (error) {
      this.logger.error(`Error retrieving account balance: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to retrieve account balance: ${error.message}`);
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
      // Capability can be:
      // - 'active' (enabled - transfers allowed)
      // - 'pending' (requested but not yet enabled - transfers NOT allowed)
      // - 'inactive' (not enabled - transfers NOT allowed)
      // Stripe requires capability to be 'active' before transfers are allowed
      const transfersCapability = account.capabilities?.transfers;
      const hasTransferCapability = transfersCapability === 'active';
      
      if (chargesEnabled && transfersCapability === 'active') {
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
   * Sync account status from Stripe to database
   * This is useful for recovering from webhook outages or missed events
   */
  async syncAccountStatus(accountId: string): Promise<{
    status: 'uninitiated' | 'pending' | 'active' | 'restricted';
    chargesEnabled: boolean;
    transfersEnabled: boolean;
    detailsSubmitted: boolean;
    wasUpdated: boolean;
  }> {
    try {
      this.logger.log(`[syncAccountStatus] Syncing status for account: ${accountId}`);
      
      // Get current status from Stripe
      const stripeStatus = await this.getAccountStatus(accountId);
      
      // Find user by Stripe account ID
      const user = await this.userService.findByStripeAccountId(accountId);
      if (!user) {
        this.logger.warn(`[syncAccountStatus] No user found for Stripe account ID: ${accountId}`);
        return {
          ...stripeStatus,
          wasUpdated: false,
        };
      }
      
      // Check if status needs to be updated
      const previousStatus = user.stripeAccountStatus;
      const needsUpdate = previousStatus !== stripeStatus.status;
      
      if (needsUpdate) {
        this.logger.log(`[syncAccountStatus] Status mismatch detected. Database: '${previousStatus}', Stripe: '${stripeStatus.status}'. Updating...`);
        user.stripeAccountStatus = stripeStatus.status;
        await this.userService.save(user);
        this.logger.log(`[syncAccountStatus] Successfully updated user ${user.id} stripeAccountStatus from '${previousStatus}' to '${stripeStatus.status}'`);
        
        // If account just became active, release any pending transfers
        if (stripeStatus.status === 'active' && previousStatus !== 'active') {
          this.logger.log(`[syncAccountStatus] Account became active, checking for pending transfers...`);
          try {
            await this.releasePendingTransfersForAccount(accountId);
          } catch (error) {
            this.logger.error(`[syncAccountStatus] Error releasing pending transfers: ${error.message}`);
            // Don't throw - status update succeeded
          }
        }
      } else {
        this.logger.log(`[syncAccountStatus] Status is already in sync: '${previousStatus}'`);
      }
      
      return {
        ...stripeStatus,
        wasUpdated: needsUpdate,
      };
    } catch (error) {
      this.logger.error(`[syncAccountStatus] Error syncing account status: ${error.message}`, error.stack);
      throw error;
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
  /*async createPaymentIntent(
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
  }*/

    async createPaymentIntent(
      amountUSD: number,
      paymentMethodId: string,
      platformFeeUSD: number,
      metadata?: Record<string, string>,
    ): Promise<Stripe.PaymentIntent> {
      try {
        // Convert dollars to cents (Stripe requires amounts in smallest currency unit)
        const amountInCents = Math.round(amountUSD * 100);
    
        // Get frontend URL for return_url
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://gohappygo.netlify.app';
    
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
        // Add return_url even though allow_redirects is 'never' (Stripe requires it)
        this.stripe.paymentIntents.confirm(paymentIntent.id, {
          payment_method: paymentMethodId,
          //return_url: `${frontendUrl}/payment/success?payment_intent=${paymentIntent.id}`,
          return_url: `${frontendUrl}/?payment_status=success`,
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
   * Refund a Payment Intent
   * @param paymentIntentId - Stripe Payment Intent ID
   * @returns Stripe Refund object
   */
  async refundPaymentIntent(paymentIntentId: string): Promise<Stripe.Refund> {
    try {
      // Retrieve the Payment Intent to get the charge ID
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (!paymentIntent.latest_charge) {
        throw new BadRequestException('Payment Intent has no charge to refund');
      }

      // Create refund for the charge
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: paymentIntent.amount, // Full refund
      });

      this.logger.log(`Refund created successfully: ${refund.id} for Payment Intent ${paymentIntentId}`);
      return refund;
    } catch (error) {
      this.logger.error(`Error refunding Payment Intent ${paymentIntentId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to refund Payment Intent: ${error.message}`);
    }
  }

  /**
   * Refund a partial amount from a Payment Intent
   * @param paymentIntentId - Stripe Payment Intent ID
   * @param amountUSD - Amount to refund in USD (will be converted to cents)
   * @returns Stripe Refund object
   */
  async refundPaymentIntentPartial(paymentIntentId: string, amountUSD: number): Promise<Stripe.Refund> {
    try {
      // Retrieve the Payment Intent to get the charge ID and verify currency
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (!paymentIntent.latest_charge) {
        throw new BadRequestException('Payment Intent has no charge to refund');
      }

      // Convert amount to cents (Stripe uses smallest currency unit)
      const amountInCents = Math.round(amountUSD * 100);

      if (amountInCents <= 0) {
        throw new BadRequestException('Refund amount must be greater than zero');
      }

      if (amountInCents > paymentIntent.amount) {
        throw new BadRequestException('Refund amount cannot exceed the original payment amount');
      }

      // Create partial refund for the charge
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountInCents,
      });

      this.logger.log(`Partial refund created successfully: ${refund.id} for Payment Intent ${paymentIntentId}, amount: ${amountUSD} USD (${amountInCents} cents)`);
      return refund;
    } catch (error) {
      this.logger.error(`Error partially refunding Payment Intent ${paymentIntentId}: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to partially refund Payment Intent: ${error.message}`);
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    this.logger.log(`[handleWebhook] Starting processing for event ${event.id} (type: ${event.type})`);
    
    try {
      // Store webhook event for idempotency and debugging
      this.logger.log(`[handleWebhook] Checking if event ${event.id} already exists in database...`);
      const existingEvent = await this.webhookEventRepository.findOne({
        where: { eventId: event.id },
      });

      if (existingEvent && existingEvent.processed) {
        this.logger.log(`[handleWebhook] Event ${event.id} already processed, skipping`);
        return;
      }

      // Save or update event
      this.logger.log(`[handleWebhook] Saving webhook event to database...`);
      if (existingEvent) {
        this.logger.log(`[handleWebhook] Updating existing event record`);
        existingEvent.processed = false; // Reset if reprocessing
        existingEvent.payload = JSON.stringify(event);
        await this.webhookEventRepository.save(existingEvent);
        this.logger.log(`[handleWebhook] Event record updated successfully`);
      } else {
        this.logger.log(`[handleWebhook] Creating new event record`);
        const webhookEvent = this.webhookEventRepository.create({
          eventId: event.id,
          eventType: event.type,
          processed: false,
          payload: JSON.stringify(event),
        });
        await this.webhookEventRepository.save(webhookEvent);
        this.logger.log(`[handleWebhook] Event record created successfully with ID: ${webhookEvent.id}`);
      }

      // Process event based on type
      this.logger.log(`[handleWebhook] Processing event type: ${event.type}`);
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
          this.logger.log(`[handleWebhook] Unhandled webhook event type: ${event.type}`);
      }
      this.logger.log(`[handleWebhook] Event type ${event.type} processed successfully`);

      // Mark event as processed
      this.logger.log(`[handleWebhook] Marking event ${event.id} as processed...`);
      const eventEntity = await this.webhookEventRepository.findOne({
        where: { eventId: event.id },
      });
      if (eventEntity) {
        eventEntity.processed = true;
        await this.webhookEventRepository.save(eventEntity);
        this.logger.log(`[handleWebhook] Event ${event.id} marked as processed`);
      } else {
        this.logger.warn(`[handleWebhook] Could not find event ${event.id} to mark as processed`);
      }
    } catch (error) {
      this.logger.error(`[handleWebhook] Error processing webhook event ${event.id}: ${error.message}`);
      this.logger.error(`[handleWebhook] Error stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Handle payment_intent.succeeded webhook
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.log(`Payment Intent succeeded: ${paymentIntent.id}`);
    
    // Find transaction by stripePaymentIntentId and update status to 'paid'
    try {
      const transaction = await this.transactionRepository.findOne({
        where: { stripePaymentIntentId: paymentIntent.id },
      });

      if (transaction) {
        await this.transactionRepository.update(
          { id: transaction.id },
          { status: 'paid' }
        );
        this.logger.log(`Transaction ${transaction.id} status updated to 'paid' for Payment Intent ${paymentIntent.id}`);
      } else {
        this.logger.warn(`No transaction found for Payment Intent ${paymentIntent.id}`);
      }
    } catch (error) {
      this.logger.error(`Error updating transaction status for Payment Intent ${paymentIntent.id}: ${error.message}`, error.stack);
    }
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
    this.logger.log(`[handleAccountUpdated] Processing account.updated webhook for account: ${account.id}`);
    this.logger.log(`[handleAccountUpdated] Account charges_enabled: ${account.charges_enabled}`);
    this.logger.log(`[handleAccountUpdated] Account details_submitted: ${account.details_submitted}`);
    
    // Check if transfers capability is now active
    const transfersCapability = account.capabilities?.transfers;
    const previousTransfersCapability = (account as any).previous_attributes?.capabilities?.transfers;
    
    this.logger.log(`[handleAccountUpdated] Transfers capability: ${transfersCapability}`);
    this.logger.log(`[handleAccountUpdated] Previous transfers capability: ${previousTransfersCapability || 'undefined'}`);
    
    // If transfers capability just became active (either detected via previous_attributes or by checking current status)
    // Release pending transfers for this account
    if (transfersCapability === 'active') {
      // Check if this is a new activation (previous was not active) or if we should check anyway
      const shouldRelease = previousTransfersCapability !== 'active' || previousTransfersCapability === undefined;
      
      this.logger.log(`[handleAccountUpdated] Should release pending transfers: ${shouldRelease}`);
      
      if (shouldRelease) {
        this.logger.log(`[handleAccountUpdated] Transfers capability is active for account ${account.id}, checking for pending transfers`);
        try {
          await this.releasePendingTransfersForAccount(account.id);
          this.logger.log(`[handleAccountUpdated] Pending transfers released successfully`);
        } catch (error) {
          this.logger.error(`[handleAccountUpdated] Error releasing pending transfers: ${error.message}`);
          // Don't throw - continue to update status
        }
      }
    }
    
    // Update user's Stripe account status
    this.logger.log(`[handleAccountUpdated] Finding user by Stripe account ID: ${account.id}`);
    const user = await this.userService.findByStripeAccountId(account.id);
    if (user) {
      this.logger.log(`[handleAccountUpdated] User found: ${user.id} (${user.email})`);
      this.logger.log(`[handleAccountUpdated] Current stripeAccountStatus: ${user.stripeAccountStatus}`);
      
      this.logger.log(`[handleAccountUpdated] Retrieving account status from Stripe...`);
      const status = await this.getAccountStatus(account.id);
      this.logger.log(`[handleAccountUpdated] Stripe account status: ${status.status}`);
      this.logger.log(`[handleAccountUpdated] chargesEnabled: ${status.chargesEnabled}, transfersEnabled: ${status.transfersEnabled}, detailsSubmitted: ${status.detailsSubmitted}`);
      
      const previousStatus = user.stripeAccountStatus;
      user.stripeAccountStatus = status.status;
      
      this.logger.log(`[handleAccountUpdated] Updating user stripeAccountStatus from '${previousStatus}' to '${status.status}'`);
      await this.userService.save(user);
      this.logger.log(`[handleAccountUpdated] User stripeAccountStatus updated successfully`);
    } else {
      this.logger.warn(`[handleAccountUpdated] No user found for Stripe account ID: ${account.id}`);
    }
  }

  /**
   * Release pending transfers for an account when transfers capability becomes active
   */
  private async releasePendingTransfersForAccount(accountId: string): Promise<void> {
    try {
      // Find user by Stripe account ID
      const user = await this.userService.findByStripeAccountId(accountId);
      if (!user) {
        this.logger.warn(`No user found for Stripe account ${accountId}`);
        return;
      }

      // Find all transactions awaiting transfer for this payee
      const pendingTransactions = await this.transactionRepository.find({
        where: {
          payeeId: user.id,
          status: 'awaiting_transfer' as any,
          stripeTransferId: IsNull(), // Not yet transferred
        },
      });

      this.logger.log(`Found ${pendingTransactions.length} transactions awaiting transfer for account ${accountId}`);

      if (pendingTransactions.length === 0) {
        return;
      }

      // Release funds for each transaction
      for (const transaction of pendingTransactions) {
        try {
          await this.releaseFundsForTransaction(transaction.id);
          this.logger.log(`Successfully released funds for transaction ${transaction.id}`);
        } catch (error) {
          this.logger.error(`Failed to release funds for transaction ${transaction.id}: ${error.message}`, error.stack);
          // Continue with other transactions even if one fails
        }
      }
    } catch (error) {
      this.logger.error(`Error releasing pending transfers for account ${accountId}: ${error.message}`, error.stack);
    }
  }

  /**
   * Release funds for a single transaction (used by webhook handler)
   */
  private async releaseFundsForTransaction(transactionId: number): Promise<void> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    // Check if transfer already created
    if (transaction.stripeTransferId) {
      this.logger.log(`Transaction ${transactionId} already has transfer ${transaction.stripeTransferId}, skipping`);
      return;
    }

    // If no Stripe Payment Intent, just update status (legacy transactions)
    if (!transaction.stripePaymentIntentId) {
      await this.transactionRepository.update(transactionId, { status: 'paid' });
      return;
    }

    // Get charge ID from Payment Intent
    const chargeId = await this.getChargeIdFromPaymentIntent(transaction.stripePaymentIntentId);

    // Get payee (traveler) user
    const payee = await this.transactionRepository.manager.findOne(UserEntity, {
      where: { id: transaction.payeeId },
    });

    if (!payee || !payee.stripeAccountId) {
      throw new NotFoundException(`Payee or Stripe account not found for transaction ${transactionId}`);
    }

    // Verify transfers capability is active (double-check)
    const accountStatus = await this.getAccountStatus(payee.stripeAccountId);
    if (!accountStatus.transfersEnabled) {
      this.logger.warn(`Account ${payee.stripeAccountId} does not have transfers enabled yet, skipping transaction ${transactionId}`);
      return;
    }

    // Calculate traveler amount
    let travelerAmountUSD: number;
    if (transaction.travelerPayment !== null && transaction.travelerPayment !== undefined) {
      travelerAmountUSD = await this.convertToUSD(
        transaction.travelerPayment,
        transaction.currencyCode || 'USD'
      );
    } else {
      // Fallback calculation for legacy transactions
      const fee = await this.platformPricingService.calculateFee(transaction.originalAmount || transaction.amount);
      const tvaAmount = (20 / 100) * fee; // 20% TVA
      const travelerPayment = (transaction.originalAmount || transaction.amount) - fee - tvaAmount;
      travelerAmountUSD = await this.convertToUSD(
        travelerPayment,
        transaction.currencyCode || 'USD'
      );
    }

    // Create Transfer
    const transfer = await this.createTransfer(
      travelerAmountUSD,
      payee.stripeAccountId,
      chargeId,
    );

    // Update transaction with transfer ID and status
    await this.transactionRepository.update(transactionId, {
      stripeTransferId: transfer.id,
      status: 'paid', // Funds successfully transferred
    });

    this.logger.log(`Successfully released funds for transaction ${transactionId}, transfer ID: ${transfer.id}`);
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
   * Retrieve Payment Intent from Stripe
   * @param paymentIntentId - Stripe Payment Intent ID
   * @returns Stripe Payment Intent object
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error(`Error retrieving Payment Intent: ${error.message}`, error.stack);
      throw new NotFoundException(`Failed to retrieve Payment Intent: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    this.logger.log(`[verifyWebhookSignature] Starting signature verification...`);
    
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error(`[verifyWebhookSignature] STRIPE_WEBHOOK_SECRET not configured in environment`);
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET not configured');
    }
    
    this.logger.log(`[verifyWebhookSignature] Webhook secret found (length: ${webhookSecret.length})`);
    this.logger.log(`[verifyWebhookSignature] Payload type: ${typeof payload}, length: ${payload ? (typeof payload === 'string' ? payload.length : payload.toString().length) : 0}`);
    this.logger.log(`[verifyWebhookSignature] Signature length: ${signature ? signature.length : 0}`);

    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      this.logger.log(`[verifyWebhookSignature] Signature verification successful`);
      return event;
    } catch (error) {
      this.logger.error(`[verifyWebhookSignature] Signature verification failed`);
      this.logger.error(`[verifyWebhookSignature] Error message: ${error.message}`);
      this.logger.error(`[verifyWebhookSignature] Error name: ${error.name}`);
      throw new BadRequestException(`Webhook signature verification failed: ${error.message}`);
    }
  }
}

