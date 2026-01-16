import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
  Headers,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserEntity } from 'src/user/user.entity';
import { CreateAccountLinkResponseDto } from './dto/create-account-link.dto';
import { AccountStatusResponseDto } from './dto/account-status-response.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(private readonly stripeService: StripeService) { }

  @Get('onboarding-link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get Stripe Connect onboarding link for current user' })
  @ApiResponse({
    status: 200,
    description: 'Onboarding link generated successfully',
    type: CreateAccountLinkResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOnboardingLink(
    @CurrentUser() user: UserEntity,
    @Req() req: any,
  ): Promise<CreateAccountLinkResponseDto> {
    // Get or create Stripe Connect account
    let accountId = user.stripeAccountId;

    if (!accountId) {
      // Create deferred account (fallback if not created during registration)
      // Use stored country code or default to FR
      const countryCode = user.stripeCountryCode || 'FR';
      const clientIp = req.ip ||
        req.connection?.remoteAddress ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        '127.0.0.1';
      const account = await this.stripeService.createConnectAccount(user, countryCode, clientIp);
      accountId = account.id;
    }

    // Create Account Link
    const url = await this.stripeService.createAccountLink(accountId);

    return { url };
  }

  @Get('account-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get Stripe Connect account status for current user' })
  @ApiResponse({
    status: 200,
    description: 'Account status retrieved successfully',
    type: AccountStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Stripe account not found' })
  async getAccountStatus(@CurrentUser() user: UserEntity): Promise<AccountStatusResponseDto> {
    if (!user.stripeAccountId) {
      return {
        accountId: null,
        status: 'uninitiated',
        chargesEnabled: false,
        transfersEnabled: false,
        detailsSubmitted: false,
      };
    }

    // Sync status from Stripe to database (fixes issues from missed webhooks)
    const status = await this.stripeService.syncAccountStatus(user.stripeAccountId);

    return {
      accountId: user.stripeAccountId,
      status: status.status,
      chargesEnabled: status.chargesEnabled,
      transfersEnabled: status.transfersEnabled,
      detailsSubmitted: status.detailsSubmitted,
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint (no authentication)' })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {

    console.log('WEBHOOK ENDPOINT HIT:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });


    this.logger.log('=== STRIPE WEBHOOK RECEIVED ===');
    this.logger.log(`Request method: ${req.method}`);
    this.logger.log(`Request URL: ${req.url}`);
    this.logger.log(`Has rawBody: ${!!req.rawBody}`);
    // Simpler fix for lines 113-116
    this.logger.log(`RawBody type: ${typeof req.rawBody}`);
    const rawBodyStr = req.rawBody
      ? (typeof req.rawBody === 'string' ? req.rawBody : Buffer.isBuffer(req.rawBody) ? req.rawBody.toString() : String(req.rawBody))
      : '';
    this.logger.log(`RawBody length: ${rawBodyStr.length}`);
    this.logger.log(`Has stripe-signature header: ${!!signature}`);
    this.logger.log(`Signature value: ${signature ? signature.substring(0, 20) + '...' : 'MISSING'}`);
    this.logger.log(`Content-Type: ${req.headers['content-type']}`);
    this.logger.log(`User-Agent: ${req.headers['user-agent']}`);

    const payload = req.rawBody;

    if (!payload) {
      this.logger.error('❌ WEBHOOK FAILED: Missing raw body');
      this.logger.error(`Request body type: ${typeof req.body}`);
      this.logger.error(`Request body exists: ${!!req.body}`);
      throw new BadRequestException('Missing raw body - webhook signature verification requires raw request body');
    }

    if (!signature) {
      this.logger.error('❌ WEBHOOK FAILED: Missing stripe-signature header');
      this.logger.error(`Available headers: ${JSON.stringify(Object.keys(req.headers))}`);
      throw new BadRequestException('Missing stripe-signature header');
    }

    try {
      // Verify webhook signature
      this.logger.log('🔐 Attempting to verify webhook signature...');
      const event = this.stripeService.verifyWebhookSignature(payload, signature);
      this.logger.log(`✅ Webhook signature verified successfully`);
      this.logger.log(`Event ID: ${event.id}`);
      this.logger.log(`Event type: ${event.type}`);
      this.logger.log(`Event created: ${new Date(event.created * 1000).toISOString()}`);

      // Handle webhook event (this saves to DB)
      this.logger.log(`📦 Processing webhook event: ${event.type}...`);
      await this.stripeService.handleWebhook(event);
      this.logger.log(`✅ Webhook event ${event.id} processed successfully`);

      return { received: true };
    } catch (error) {
      this.logger.error(`❌ WEBHOOK PROCESSING FAILED`);
      this.logger.error(`Error message: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      this.logger.error(`Error name: ${error.name}`);
      if (error.response) {
        this.logger.error(`Error response: ${JSON.stringify(error.response)}`);
      }
      throw error;
    }
  }
}

