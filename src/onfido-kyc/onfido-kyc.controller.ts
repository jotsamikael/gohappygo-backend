import { 
  Body, 
  Controller, 
  Get, 
  Post, 
  Req, 
  UseGuards, 
  Headers,
  Logger,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { OnfidoKycService } from './onfido-kyc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorattor';
import { UserEntity } from '../user/user.entity';
import { 
  OnfidoStartResponseDto, 
  OnfidoStatusResponseDto, 
  OnfidoWebhookResponseDto,
  OnfidoWorkflowRunDetailsResponseDto,
  OnfidoWebhookRequestDto
} from './dto/onfido-kyc.dto';

@ApiTags('onfido-kyc')
@Controller('onfido-kyc')
export class OnfidoKycController {
  private readonly logger = new Logger(OnfidoKycController.name);

  constructor(private readonly onfidoKycService: OnfidoKycService) {}

  /**
   * START KYC PROCESS
   * Creates an applicant and workflow run with Onfido, returns SDK token for client-side verification
   * uses data of logged in user
   */
  @Post('start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Start Onfido KYC verification process',
    description: 'Initiates a new KYC verification session with Onfido and returns the SDK token for client-side verification. No request body required as it uses the authenticated user data.',
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Onfido KYC session created successfully',
    type: OnfidoStartResponseDto
  })
  @ApiResponse({ status: 400, description: 'Failed to create Onfido KYC session' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async startKyc(@CurrentUser() user: UserEntity) {
    this.logger.log(`Onfido KYC start requested by user ${user.id}`);
    
    // Check if user already has a pending KYC session
    if (user.kycStatus === 'pending') {
      throw new BadRequestException('KYC verification is already in progress');
    }
    
    // Check if user is already verified
    if (user.kycStatus === 'approved') {
      throw new BadRequestException('User is already verified');
    }

    // Start the KYC process
    return await this.onfidoKycService.start(user);
  }

  /**
   * WEBHOOK ENDPOINT
   * Receives status updates from Onfido about verification progress
   * This endpoint is called by Onfido, not by your frontend
   */
  @Post('webhook')
  @ApiOperation({ 
    summary: 'Onfido webhook endpoint',
    description: 'Receives status updates from Onfido about KYC verification progress. This is called by Onfido, not by your application.'
  })
  @ApiBody({ 
    type: OnfidoWebhookRequestDto, 
    description: 'Webhook payload from Onfido containing event data and resource information',
    required: true 
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully', type: OnfidoWebhookResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload or missing signature' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Req() req: any, 
    @Headers('x-onfido-signature') signature: string
  ) {
    this.logger.log('Received webhook from Onfido');
    
    // Get the raw body for signature verification
    const rawBody = req.rawBody || JSON.stringify(req.body);
    
    if (!signature) {
      this.logger.error('Webhook missing signature header');
      throw new BadRequestException('Missing webhook signature');
    }

    try {
      // Process the webhook
      await this.onfidoKycService.handleWebhook(rawBody, signature);
      
      this.logger.log('Webhook processed successfully');
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * GET KYC STATUS
   * Returns the current KYC verification status for the authenticated user
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get Onfido KYC verification status',
    description: 'Returns the current KYC verification status for the authenticated user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'KYC status retrieved successfully',
    type: OnfidoStatusResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getKycStatus(@CurrentUser() user: UserEntity) {
    this.logger.log(`Onfido KYC status requested by user ${user.id}`);
    
    return await this.onfidoKycService.getStatus(user.id);
  }

  /**
   * GET WORKFLOW RUN DETAILS
   * Returns detailed information about the current KYC session
   */
  @Get('workflow-run-details')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get detailed Onfido KYC workflow run information',
    description: 'Returns detailed information about the current Onfido KYC verification workflow run'
  })
  @ApiResponse({ status: 200, description: 'Workflow run details retrieved successfully', type: OnfidoWorkflowRunDetailsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWorkflowRunDetails(@CurrentUser() user: UserEntity) {
    this.logger.log(`Onfido workflow run details requested by user ${user.id}`);
    
    return await this.onfidoKycService.getWorkflowRunDetails(user.id);
  }
}
