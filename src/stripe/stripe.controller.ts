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
  constructor(private readonly stripeService: StripeService) {}

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

    const status = await this.stripeService.getAccountStatus(user.stripeAccountId);

    return {
      accountId: user.stripeAccountId,
      ...status,
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
    const payload = req.rawBody;

    if (!payload) {
      throw new Error('Missing raw body');
    }

    // Verify webhook signature
    const event = this.stripeService.verifyWebhookSignature(payload, signature);

    // Handle webhook event
    await this.stripeService.handleWebhook(event);

    return { received: true };
  }
}

