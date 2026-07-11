import { Injectable, BadRequestException, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { UserEntity } from 'src/user/user.entity';
import { UserService } from 'src/user/user.service';
import { CurrencyService } from 'src/currency/currency.service';
import { PlatformPricingService } from 'src/platform-pricing/platform-pricing.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { StripeWebhookEventEntity } from './entities/stripe-webhook-event.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { CustomBadRequestException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { OnboardingClient } from './dto/get-onboarding-link-query.dto';
import { resolveStripeOnboardingUrls } from './stripe-onboarding-urls.util';

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
    private eventEmitter: EventEmitter2,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not found in environment variables');
    }
    //  apiVersion: '2025-02-24.acacia',
    this.stripe = new Stripe(secretKey || '', {
      //apiVersion: '2025-12-15.clover',
      apiVersion: '2025-02-24.acacia',
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
   * Create an Account Link for onboarding or updating account
   * Uses 'account_update' for existing accounts that need verification/updates
   * Uses 'account_onboarding' for new accounts
   */
  async createAccountLink(
    accountId: string,
    client: OnboardingClient = OnboardingClient.WEB,
  ): Promise<string> {
    try {
      const { returnUrl, refreshUrl } = resolveStripeOnboardingUrls(
        this.configService,
        client,
      );

      // Retrieve account to determine link type
      const account = await this.stripe.accounts.retrieve(accountId);
      
      // Determine link type:
      // - If account has been onboarded before (details_submitted = true), use 'account_update'
      // - This ensures verification documents and other requirements are shown
      // - If account is new (details_submitted = false), use 'account_onboarding'
      const linkType = account.details_submitted ? 'account_update' : 'account_onboarding';
      
      // Check if there are pending requirements (like verification documents)
      const hasPendingRequirements = account.requirements?.currently_due && 
        account.requirements.currently_due.length > 0;
      
      this.logger.log(
        `Creating account link for account ${accountId}: ` +
        `client=${client}, type=${linkType}, details_submitted=${account.details_submitted}, ` +
        `hasPendingRequirements=${hasPendingRequirements}, return_url=${returnUrl}`,
      );
      
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: linkType,
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
   * Get account requirements (currently_due, past_due, and eventually_due)
   * Returns null if there are no requirements
   */
  async getAccountRequirements(accountId: string): Promise<{
    hasRequirements: boolean;
    currentlyDue: string[];
    pastDue: string[];
    eventuallyDue: string[];
  } | null> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      
      // Check if requirements object exists
      if (!account.requirements) {
        this.logger.debug(`No requirements object found for account ${accountId}`);
        return null;
      }
      
      const currentlyDue = account.requirements.currently_due || [];
      const pastDue = account.requirements.past_due || [];
      const eventuallyDue = account.requirements.eventually_due || [];
      
      // Check if there are any requirements at all
      const hasAnyRequirements = currentlyDue.length > 0 || pastDue.length > 0 || eventuallyDue.length > 0;
      
      // Also check if account is restricted/disabled due to requirements
      const isRestricted = account.requirements.disabled_reason !== null && account.requirements.disabled_reason !== undefined;
      
      // Log the account structure for debugging
      this.logger.log(`Account requirements check for ${accountId}:`, {
        hasRequirements: hasAnyRequirements || isRestricted,
        currentlyDueCount: currentlyDue.length,
        pastDueCount: pastDue.length,
        eventuallyDueCount: eventuallyDue.length,
        currentlyDue: currentlyDue,
        pastDue: pastDue,
        eventuallyDue: eventuallyDue,
        disabledReason: account.requirements.disabled_reason,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      });
      
      // Return null only if there are truly no requirements
      if (!hasAnyRequirements && !isRestricted) {
        this.logger.debug(`No requirements found for account ${accountId}`);
        return null;
      }
      
      // If there are requirements (even if only in eventually_due), return them
      this.logger.log(`Found requirements for account ${accountId}: currently_due=${currentlyDue.length}, past_due=${pastDue.length}, eventually_due=${eventuallyDue.length}, disabled_reason=${account.requirements.disabled_reason || 'none'}`);
      
      return {
        hasRequirements: hasAnyRequirements || isRestricted,
        currentlyDue: currentlyDue,
        pastDue: pastDue,
        eventuallyDue: eventuallyDue,
      };
    } catch (error) {
      this.logger.error(`Error retrieving account requirements for ${accountId}: ${error.message}`, error.stack);
      // Return null on error - requirements retrieval failure shouldn't break the endpoint
      return null;
    }
  }

  /**
   * Get platform balance (available and pending)
   * Returns the platform's own Stripe balance (not a connected account)
   */
  async getPlatformBalance(): Promise<{ available: number; pending: number; currency: string }> {
    try {
      const balance = await this.stripe.balance.retrieve();
      return {
        available: balance.available[0]?.amount ? balance.available[0].amount / 100 : 0,
        pending: balance.pending[0]?.amount ? balance.pending[0].amount / 100 : 0,
        currency: balance.available[0]?.currency || 'usd',
      };
    } catch (error) {
      this.logger.error(`Error retrieving platform balance: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to retrieve platform balance: ${error.message}`);
    }
  }

  /**
   * Check if account has external accounts (bank accounts or debit cards) configured
   * Required for transfers to work even if transfers capability is active
   */
  private async hasExternalAccount(accountId: string): Promise<boolean> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId, {
        expand: ['external_accounts'],
      });
      
      // Check if account has any external accounts (bank accounts or debit cards)
      const externalAccounts = account.external_accounts?.data || [];
      const hasExternalAccount = externalAccounts.length > 0;
      
      this.logger.log(`Account ${accountId} has ${externalAccounts.length} external account(s)`);
      return hasExternalAccount;
    } catch (error) {
      this.logger.error(`Error checking external accounts: ${error.message}`, error.stack);
      return false;
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
      
      // IMPORTANT: Even if transfers capability is 'active', Stripe requires an external account
      // (bank account or debit card) to be configured before transfers can actually work.
      // The error "stripe_balance.stripe_transfers feature enabled" indicates missing external account.
      const hasExternalAccount = await this.hasExternalAccount(accountId);
      const transfersEnabled = hasTransferCapability && hasExternalAccount;
      
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
        transfersEnabled,
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
      confirmSynchronously: boolean = false,
    ): Promise<Stripe.PaymentIntent> {
      try {
        // Convert dollars to cents (Stripe requires amounts in smallest currency unit)
        const amountInCents = Math.round(amountUSD * 100);
    
        // Get frontend URL for return_url
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://gohappygo.netlify.app';
    
        // Create Payment Intent
        const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
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
        };

        // If synchronous confirmation is requested, add confirm: true
        if (confirmSynchronously) {
          paymentIntentParams.confirm = true;
          paymentIntentParams.return_url = `${frontendUrl}/?payment_status=success`;
        }

        const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentParams);
    
        // If not synchronous, confirm asynchronously (don't await - let it process in background)
        // The webhook will handle the success/failure
        if (!confirmSynchronously) {
          // Add return_url even though allow_redirects is 'never' (Stripe requires it)
          this.stripe.paymentIntents.confirm(paymentIntent.id, {
            payment_method: paymentMethodId,
            return_url: `${frontendUrl}/?payment_status=success`,
          }).catch(error => {
            this.logger.error(`Error confirming Payment Intent ${paymentIntent.id}: ${error.message}`, error.stack);
          });
        }
    
        return paymentIntent;
      } catch (error) {
        this.logger.error(`Error creating Payment Intent: ${error.message}`, error.stack);
        throw new BadRequestException(`Failed to create Payment Intent: ${error.message}`);
      }
    }
  /**
   * Validate and confirm Payment Intent synchronously
   * This method creates and confirms a Payment Intent in one call, awaiting the result.
   * Used for fraud protection - payment must succeed before creating requests/reserving weight.
   * 
   * @param amountUSD - Amount in USD (in dollars, will be converted to cents)
   * @param paymentMethodId - Stripe Payment Method ID
   * @param platformFeeUSD - Platform fee in USD (in dollars, will be converted to cents)
   * @param metadata - Additional metadata to attach
   * @returns Confirmed Payment Intent with status 'succeeded' or throws error
   * @throws CustomBadRequestException with specific error codes for different failure types
   */
  async validateAndConfirmPaymentIntent(
    amountUSD: number,
    paymentMethodId: string,
    platformFeeUSD: number,
    metadata?: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    try {
      // Create and confirm Payment Intent synchronously
      const paymentIntent = await this.createPaymentIntent(
        amountUSD,
        paymentMethodId,
        platformFeeUSD,
        metadata,
        true, // confirmSynchronously = true
      );

      // Check payment status
      if (paymentIntent.status === 'succeeded') {
        this.logger.log(`Payment Intent ${paymentIntent.id} confirmed successfully`);
        return paymentIntent;
      }

      // Handle requires_action (3D Secure)
      if (paymentIntent.status === 'requires_action') {
        this.logger.warn(`Payment Intent ${paymentIntent.id} requires action (3D Secure)`);
        throw new CustomBadRequestException(
          'Payment requires additional authentication. Please complete 3D Secure authentication.',
          ErrorCode.PAYMENT_PROCESSING_FAILED,
        );
      }

      // Handle other failure statuses
      const errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
      const errorCode = paymentIntent.last_payment_error?.code;
      
      // Map Stripe error codes to application error codes
      const mappedError = this.mapStripeErrorToApplicationError(errorCode, errorMessage);
      throw new CustomBadRequestException(mappedError.message, mappedError.errorCode as ErrorCode);

    } catch (error) {
      // If it's already a CustomBadRequestException, re-throw it
      if (error instanceof CustomBadRequestException) {
        throw error;
      }

      // If it's a BadRequestException from createPaymentIntent, wrap it
      if (error instanceof BadRequestException) {
        // Try to extract error code from message or use generic
        throw new CustomBadRequestException(
          error.message,
          ErrorCode.PAYMENT_PROCESSING_FAILED,
        );
      }

      // Handle Stripe API errors
      if (error.type === 'StripeCardError' || error.type === 'StripeInvalidRequestError') {
        const stripeError = error as Stripe.errors.StripeCardError | Stripe.errors.StripeInvalidRequestError;
        const mappedError = this.mapStripeErrorToApplicationError(stripeError.code, stripeError.message);
        throw new CustomBadRequestException(mappedError.message, mappedError.errorCode as ErrorCode);
      }

      // Generic error handling
      this.logger.error(`Error validating payment: ${error.message}`, error.stack);
      throw new CustomBadRequestException(
        `Failed to validate payment: ${error.message}`,
        ErrorCode.PAYMENT_PROCESSING_FAILED,
      );
    }
  }

  /**
   * Map Stripe error codes to application error codes and user-friendly messages
   * @param stripeErrorCode - Stripe error code (e.g., 'card_declined', 'insufficient_funds')
   * @param stripeErrorMessage - Original Stripe error message
   * @returns Object with errorCode and message
   */
  private mapStripeErrorToApplicationError(
    stripeErrorCode?: string,
    stripeErrorMessage?: string,
  ): { errorCode: string; message: string } {
    const defaultMessage = stripeErrorMessage || 'Payment processing failed. Please try again or use a different payment method.';

    // Map common Stripe error codes
    switch (stripeErrorCode) {
      case 'card_declined':
        return {
          errorCode: 'PAYMENT_CARD_DECLINED',
          message: 'Your card was declined. Please try another payment method.',
        };
      
      case 'insufficient_funds':
        return {
          errorCode: 'PAYMENT_INSUFFICIENT_FUNDS',
          message: 'Insufficient funds. Please use a different card or add funds to your account.',
        };
      
      case 'expired_card':
        return {
          errorCode: 'PAYMENT_CARD_EXPIRED',
          message: 'Your card has expired. Please use a different payment method.',
        };
      
      case 'incorrect_number':
      case 'invalid_number':
      case 'invalid_expiry_month':
      case 'invalid_expiry_year':
      case 'invalid_cvc':
        return {
          errorCode: 'PAYMENT_INVALID_CARD',
          message: 'Invalid card details. Please check your card information and try again.',
        };
      
      case 'processing_error':
      case 'api_connection_error':
      case 'api_error':
      case 'authentication_required':
        return {
          errorCode: 'PAYMENT_PROCESSING_FAILED',
          message: defaultMessage,
        };
      
      default:
        return {
          errorCode: 'PAYMENT_PROCESSING_FAILED',
          message: defaultMessage,
        };
    }
  }

  /**
   * Create Transfer to connected account (release escrow funds)
   * @param amountUSD - Amount in USD (in dollars, will be converted to cents)
   * @param destinationAccountId - Stripe Connect account ID
   * @param sourceTransactionId - Charge ID from the original Payment Intent
   * @param transactionId - Optional transaction ID for idempotency key generation
   */
  async createTransfer(
    amountUSD: number,
    destinationAccountId: string,
    sourceTransactionId: string,
    transactionId?: number,
  ): Promise<Stripe.Transfer> {
    try {
      // Check if account has external account configured before attempting transfer
      // This prevents the "stripe_balance.stripe_transfers feature enabled" error
      const hasExternalAccount = await this.hasExternalAccount(destinationAccountId);
      if (!hasExternalAccount) {
        throw new BadRequestException(
          'Account must have a bank account or debit card configured to receive transfers. ' +
          'Please complete Stripe onboarding and add a payout method.'
        );
      }

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

      // Generate idempotency key to prevent duplicate transfers on retries
      const idempotencyKey = transactionId 
        ? `transaction-${transactionId}-release`
        : `transfer-${sourceTransactionId}-${Date.now()}`;

      const transfer = await this.stripe.transfers.create({
        amount: transferAmount,
        currency: balanceTransactionCurrency, // MUST match balance transaction currency, not charge currency
        destination: destinationAccountId,
        source_transaction: sourceTransactionId, // Link to original charge
      }, {
        idempotencyKey,
      });

      this.logger.log(`Transfer created successfully: ${transfer.id}`);
      return transfer;
    } catch (error) {
      // Catch specific Stripe error about missing stripe_balance.stripe_transfers feature
      if (error.message.includes('stripe_balance.stripe_transfers') ||
          error.message.includes('stripe_transfers feature') ||
          error.message.includes('bank account') ||
          error.message.includes('debit card') ||
          error.message.includes('external account')) {
        this.logger.error(`Transfer failed: Account ${destinationAccountId} needs external account configured. Error: ${error.message}`);
        throw new BadRequestException(
          'Account must have a bank account or debit card configured to receive transfers. ' +
          'Please complete Stripe onboarding and add a payout method. ' +
          `Original error: ${error.message}`
        );
      }
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
   * Refund a partial amount from a Payment Intent (idempotent when idempotencyKey is provided).
   * Caps the refund at the charge's remaining unrefunded amount.
   * @returns Stripe Refund, or null if nothing remains to refund on the charge.
   */
  async refundPaymentIntentPartial(
    paymentIntentId: string,
    amountUSD: number,
    idempotencyKey?: string,
  ): Promise<Stripe.Refund | null> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge'],
      });

      if (!paymentIntent.latest_charge) {
        throw new BadRequestException('Payment Intent has no charge to refund');
      }

      const charge =
        typeof paymentIntent.latest_charge === 'string'
          ? await this.stripe.charges.retrieve(paymentIntent.latest_charge)
          : paymentIntent.latest_charge;

      const remainingRefundableCents = charge.amount - charge.amount_refunded;
      if (remainingRefundableCents <= 0) {
        this.logger.log(
          `Partial refund skipped for Payment Intent ${paymentIntentId}: charge already fully refunded`,
        );
        return null;
      }

      const requestedCents = Math.round(amountUSD * 100);
      if (requestedCents <= 0) {
        throw new BadRequestException('Refund amount must be greater than zero');
      }

      const amountInCents = Math.min(requestedCents, remainingRefundableCents);
      if (amountInCents < requestedCents) {
        this.logger.warn(
          `Partial refund capped for Payment Intent ${paymentIntentId}: requested ${requestedCents} cents, refunding ${amountInCents} cents (remaining on charge)`,
        );
      }

      const refund = await this.stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: amountInCents,
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      );

      this.logger.log(
        `Partial refund created successfully: ${refund.id} for Payment Intent ${paymentIntentId}, amount: ${amountInCents / 100} USD (${amountInCents} cents)`,
      );
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
          await this.handleAccountUpdated(
            event.data.object as Stripe.Account,
            (event.data as { previous_attributes?: Record<string, unknown> }).previous_attributes,
          );
          break;
        case 'capability.updated':
          await this.handleCapabilityUpdated(event);
          break;
        case 'balance.available':
          // Optional: Trigger fund release processing when balance becomes available
          // Note: Stripe may not send this event in all regions/account types
          this.logger.log(`[handleWebhook] Balance available event received, triggering fund release processing`);
          this.eventEmitter.emit('stripe.balance.available', event.data.object);
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
    this.logger.error(`Payment Intent failure reason: ${paymentIntent.last_payment_error?.message || 'Unknown'}`);
    this.logger.error(`Payment Intent failure code: ${paymentIntent.last_payment_error?.code || 'Unknown'}`);

    try {
      // Find transaction by stripePaymentIntentId
      const transaction = await this.transactionRepository.findOne({
        where: { stripePaymentIntentId: paymentIntent.id },
        relations: ['request'],
      });

      if (!transaction) {
        this.logger.warn(`No transaction found for failed Payment Intent ${paymentIntent.id}`);
        return;
      }

      this.logger.log(`Found transaction ${transaction.id} for failed Payment Intent ${paymentIntent.id}`);

      // Update transaction status to 'failed' (or we could use 'cancelled' status)
      // Note: We don't have 'failed' status in enum, so we'll use 'cancelled'
      await this.transactionRepository.update(transaction.id, {
        status: 'cancelled' as any,
      });
      this.logger.log(`Transaction ${transaction.id} status updated to 'cancelled'`);

      // Find associated request
      if (transaction.requestId) {
        // Note: Request relation might not be loaded, so we need to fetch it separately if needed
        // For now, we'll log the requestId and let the application handle cleanup if needed
        this.logger.log(`Associated request ID: ${transaction.requestId}`);

        // Note: With synchronous payment validation, this webhook should rarely fire for new requests
        // This is mainly for edge cases and legacy data where payment was async
        // The request should already be in a terminal state or not created if payment failed synchronously
      }

      // Log failure details for debugging
      this.logger.error(`Payment failure details:`, {
        paymentIntentId: paymentIntent.id,
        transactionId: transaction.id,
        requestId: transaction.requestId,
        errorMessage: paymentIntent.last_payment_error?.message,
        errorCode: paymentIntent.last_payment_error?.code,
        declineCode: paymentIntent.last_payment_error?.decline_code,
      });

      // TODO: Could emit event to notify user about payment failure
      // this.eventEmitter.emit('payment.failed', { transactionId: transaction.id, requestId: transaction.requestId });

    } catch (error) {
      this.logger.error(`Error handling Payment Intent failure: ${error.message}`, error.stack);
      // Don't throw - webhook processing should continue even if cleanup fails
    }
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
   * Sync user stripeAccountStatus (and release pending transfers when appropriate)
   * from a Stripe Account object. Used by account.updated and capability.updated webhooks.
   */
  private async syncUserFromStripeAccount(
    account: Stripe.Account,
    options?: { previousTransfersCapability?: string },
  ): Promise<void> {
    const logPrefix = '[syncUserFromStripeAccount]';
    this.logger.log(`${logPrefix} Syncing user for account: ${account.id}`);

    const transfersCapability = account.capabilities?.transfers;
    const previousTransfersCapability = options?.previousTransfersCapability;

    this.logger.log(`${logPrefix} Transfers capability: ${transfersCapability}`);
    this.logger.log(
      `${logPrefix} Previous transfers capability: ${previousTransfersCapability ?? 'undefined'}`,
    );

    if (transfersCapability === 'active') {
      const hasExternalAccount = await this.hasExternalAccount(account.id);

      if (hasExternalAccount) {
        const shouldRelease =
          previousTransfersCapability !== 'active' ||
          previousTransfersCapability === undefined;

        if (shouldRelease) {
          this.logger.log(
            `${logPrefix} Releasing pending transfers for account ${account.id}`,
          );
          try {
            await this.releasePendingTransfersForAccount(account.id);
          } catch (error) {
            this.logger.error(
              `${logPrefix} Error releasing pending transfers: ${error.message}`,
            );
          }
        }
      } else {
        this.logger.log(
          `${logPrefix} Transfers active but external account missing for ${account.id}`,
        );
      }
    }

    const user = await this.userService.findByStripeAccountId(account.id);
    if (!user) {
      this.logger.warn(`${logPrefix} No user found for Stripe account ID: ${account.id}`);
      return;
    }

    const status = await this.getAccountStatus(account.id);
    const previousStatus = user.stripeAccountStatus;

    if (previousStatus !== status.status) {
      user.stripeAccountStatus = status.status;
      await this.userService.save(user);
      this.logger.log(
        `${logPrefix} Updated user ${user.id} stripeAccountStatus from '${previousStatus}' to '${status.status}'`,
      );

      if (status.status === 'active' && previousStatus !== 'active') {
        try {
          await this.releasePendingTransfersForAccount(account.id);
        } catch (error) {
          this.logger.error(
            `${logPrefix} Error releasing pending transfers after activation: ${error.message}`,
          );
        }
      }
    } else {
      this.logger.log(`${logPrefix} Status already in sync: '${previousStatus}'`);
    }
  }

  /**
   * Handle account.updated webhook
   */
  private async handleAccountUpdated(
    account: Stripe.Account,
    previousAttributes?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(
      `[handleAccountUpdated] Processing account.updated webhook for account: ${account.id}`,
    );

    const previousCapabilities = previousAttributes?.capabilities as
      | { transfers?: string }
      | undefined;
    const previousTransfersCapability = previousCapabilities?.transfers;

    await this.syncUserFromStripeAccount(account, { previousTransfersCapability });
  }

  /**
   * Handle capability.updated webhook (Connect account capability changes)
   */
  private async handleCapabilityUpdated(event: Stripe.Event): Promise<void> {
    const accountId = event.account;
    if (!accountId) {
      this.logger.warn('[handleCapabilityUpdated] capability.updated without account id');
      return;
    }

    this.logger.log(
      `[handleCapabilityUpdated] Processing capability.updated for account: ${accountId}`,
    );

    const account = await this.stripe.accounts.retrieve(accountId);
    await this.syncUserFromStripeAccount(account);
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
      transactionId, // Pass transactionId for idempotency key
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
   * Create a payout to seller's external bank account
   * Transfers funds from seller's Stripe Connect account balance to their bank account
   * @param accountId - Stripe Connect account ID
   * @param amountUSD - Amount in USD (in dollars, will be converted to cents)
   * @param description - Optional description for the payout
   * @returns Stripe Payout object
   */
  async createPayout(
    accountId: string,
    amountUSD: number,
    description?: string,
  ): Promise<Stripe.Payout> {
    try {
      // Check if account has external account configured
      const hasExternalAccount = await this.hasExternalAccount(accountId);
      if (!hasExternalAccount) {
        throw new BadRequestException(
          'Account must have a bank account or debit card configured to receive payouts. ' +
          'Please add a payout method in your Stripe account settings.'
        );
      }

      // Get account balance to verify sufficient funds
      const balance = await this.getAccountBalance(accountId);
      const availableBalance = balance.available[0]?.amount ? balance.available[0].amount / 100 : 0;
      const balanceCurrency = balance.available[0]?.currency || 'usd';

      // Convert amount to cents
      const amountInCents = Math.round(amountUSD * 100);

      // Check if sufficient balance available
      if (availableBalance < amountUSD) {
        throw new BadRequestException(
          `Insufficient balance. Available: ${availableBalance} ${balanceCurrency.toUpperCase()}, Requested: ${amountUSD} USD`
        );
      }

      // Get account to determine currency
      const account = await this.stripe.accounts.retrieve(accountId);
      const accountCurrency = account.default_currency || 'usd';

      // Convert USD amount to account currency if needed
      let payoutAmount: number;
      if (accountCurrency.toLowerCase() === 'usd') {
        payoutAmount = amountInCents;
      } else {
        // For non-USD accounts, use available balance directly
        const availableBalanceCents = balance.available[0]?.amount || 0;
        if (balanceCurrency.toLowerCase() !== accountCurrency.toLowerCase()) {
          this.logger.warn(`Currency mismatch: Balance is ${balanceCurrency}, Account default is ${accountCurrency}. Using balance currency.`);
        }
        // Use the balance currency amount directly
        payoutAmount = Math.min(amountInCents, availableBalanceCents);
      }

      this.logger.log(`Creating payout: ${payoutAmount / 100} ${accountCurrency.toUpperCase()} to account ${accountId}`);

      // Create payout on the connected account
      // For Custom accounts, payouts are created directly on the connected account
      // Stripe will automatically use the default external account (bank account) configured
      const payout = await this.stripe.payouts.create(
        {
          amount: payoutAmount,
          currency: accountCurrency,
          description: description || `Payout to ${accountId}`,
          // For Custom accounts, Stripe automatically uses the default external account
          // No need to specify destination
        },
        {
          stripeAccount: accountId, // Create payout on the connected account
        }
      );

      this.logger.log(`Payout created successfully: ${payout.id}`);
      return payout;
    } catch (error) {
      this.logger.error(`Error creating Payout: ${error.message}`, error.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to create Payout: ${error.message}`);
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

