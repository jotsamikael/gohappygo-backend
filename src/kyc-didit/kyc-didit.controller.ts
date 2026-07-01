import {
  Controller,
  Get,
  Post,
  Req,
  Query,
  UseGuards,
  Headers,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { KycDiditService } from './kyc-didit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorattor';
import { UserEntity } from '../user/user.entity';
import {
  KycSessionDetailsResponseDto,
  KycStartResponseDto,
  KycStatusResponseDto,
} from './dto/kyc-didit.dto';
import { KycClient, StartKycQueryDto } from './dto/start-kyc-query.dto';

@ApiTags('kyc')
@Controller('kyc')
export class KycDiditController {
  private readonly logger = new Logger(KycDiditController.name);

  constructor(private readonly kycService: KycDiditService) {}

  @Post('start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Start KYC verification process',
    description:
      'Initiates a new KYC verification session with Didit and returns the redirect URL for the user to complete verification',
  })
  @ApiResponse({
    status: 201,
    description: 'KYC session created successfully',
    type: KycStartResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Failed to create KYC session' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async startKyc(
    @CurrentUser() user: UserEntity,
    @Query() query: StartKycQueryDto,
  ) {
    const client = query.client ?? KycClient.WEB;
    this.logger.log(`KYC start requested by user ${user.id}, client=${client}`);

    if (user.kycStatus === 'approved') {
      throw new BadRequestException('User is already verified');
    }

    return await this.kycService.start(user, client);
  }

  @Post('webhook')
  @ApiOperation({
    summary: 'Didit webhook endpoint',
    description:
      'Receives status updates from Didit about KYC verification progress. This is called by Didit, not by your application.',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Req() req: any,
    @Headers('x-didit-signature') signature: string,
  ) {
    this.logger.log('Received webhook from Didit');

    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!signature) {
      this.logger.error('Webhook missing signature header');
      throw new BadRequestException('Missing webhook signature');
    }

    try {
      await this.kycService.handleWebhook(rawBody, signature);

      this.logger.log('Webhook processed successfully');
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      throw error;
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get KYC verification status',
    description:
      'Returns the current KYC verification status for the authenticated user, synced from Didit when a session exists',
  })
  @ApiResponse({
    status: 200,
    description: 'KYC status retrieved successfully',
    type: KycStatusResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getKycStatus(@CurrentUser() user: UserEntity) {
    this.logger.log(`KYC status requested by user ${user.id}`);

    return await this.kycService.syncKycStatus(user.id);
  }

  @Get('session-details')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get detailed KYC session information',
    description:
      'Returns detailed information about the current KYC verification session',
  })
  @ApiResponse({
    status: 200,
    description: 'Session details retrieved successfully',
    type: KycSessionDetailsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSessionDetails(@CurrentUser() user: UserEntity) {
    this.logger.log(`Session details requested by user ${user.id}`);

    return await this.kycService.getSessionDetails(user.id);
  }
}
