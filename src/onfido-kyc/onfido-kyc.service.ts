import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { UserEntity } from '../user/user.entity';
import { UserEventsService } from '../events/user-events.service';
import * as crypto from 'crypto';

@Injectable()
export class OnfidoKycService {
  private readonly logger = new Logger(OnfidoKycService.name);
  
  // Environment variables for Onfido API configuration
  private apiToken = process.env.ONFIDO_API_TOKEN!;
  private baseUrl = process.env.ONFIDO_BASE_URL || 'https://api.onfido.com/v3.6';
  private webhookToken = process.env.ONFIDO_WEBHOOK_TOKEN!;
  private workflowId = process.env.ONFIDO_WORKFLOW_ID!;
  
  constructor(
    private readonly http: HttpService,
    @InjectRepository(UserEntity) private users: Repository<UserEntity>,
    private readonly userEventsService: UserEventsService,
  ) {}

  /**
   * START KYC PROCESS - Creates an applicant and workflow run with Onfido
   */
  async start(user: UserEntity) {
    this.logger.log(`Starting Onfido KYC process for user ${user.id} (${user.email})`);
    
    // Add debugging
    console.log('Environment check:');
    console.log('ONFIDO_API_TOKEN:', process.env.ONFIDO_API_TOKEN ? 'Set' : 'Not set');
    console.log('ONFIDO_BASE_URL:', process.env.ONFIDO_BASE_URL);
    console.log('ONFIDO_WORKFLOW_ID:', process.env.ONFIDO_WORKFLOW_ID);
    
    try {
      // Step 1: Create applicant in Onfido
      const applicant = await this.createApplicant(user);
      this.logger.log(`Applicant created: ${applicant.id}`);

      // Step 2: Create workflow run
      const workflowRun = await this.createWorkflowRun(applicant.id);
      this.logger.log(`Workflow run created: ${workflowRun.id}`);

      // Step 3: Generate SDK token for client-side verification
      const sdkToken = await this.generateSdkToken(applicant.id);
      this.logger.log(`SDK token generated for applicant: ${applicant.id}`);

      // Update user record with KYC session information
      await this.users.update(user.id, {
        kycProvider: 'onfido',
        kycReference: workflowRun.id,
        kycStatus: 'pending',
        kycUpdatedAt: new Date(),
      });

      this.logger.log(`User ${user.id} KYC status updated to pending`);

      // Emit KYC started event
      this.userEventsService.emitKycStarted(user, workflowRun.id, sdkToken, 'onfido');

      return { 
        sdkToken,
        workflowRunId: workflowRun.id,
        message: 'Onfido KYC session created successfully. Use SDK token for client-side verification.'
      };
      
    } catch (error) {
      this.logger.error(`Failed to create Onfido KYC session for user ${user.id}: ${error.message}`);
      this.logger.error(`Error response: ${JSON.stringify(error.response?.data)}`);
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        throw new BadRequestException('Invalid Onfido API credentials');
      } else if (error.response?.status === 400) {
        throw new BadRequestException(`Invalid request to Onfido: ${error.response.data?.message || 'Unknown error'}`);
      } else {
        throw new BadRequestException('Failed to start KYC process. Please try again later.');
      }
    }
  }

  /**
   * CREATE APPLICANT - Creates an applicant in Onfido
   */
  private async createApplicant(user: UserEntity) {
    const applicantData = {
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
      phone_number: user.phone || undefined,
    };

    this.logger.log(`Creating Onfido applicant for user ${user.id}`);

    const response = await firstValueFrom(
      this.http.post(`${this.baseUrl}/applicants`, applicantData, {
        headers: { 
          'Authorization': `Token token=${this.apiToken}`,
          'Content-Type': 'application/json'
        },
      }),
    );

    return response.data;
  }

  /**
   * CREATE WORKFLOW RUN - Creates a workflow run for the applicant
   */
  private async createWorkflowRun(applicantId: string) {
    const workflowRunData = {
      applicant_id: applicantId,
      workflow_id: this.workflowId,
    };

    this.logger.log(`Creating Onfido workflow run for applicant ${applicantId}`);

    const response = await firstValueFrom(
      this.http.post(`${this.baseUrl}/workflow_runs`, workflowRunData, {
        headers: { 
          'Authorization': `Token token=${this.apiToken}`,
          'Content-Type': 'application/json'
        },
      }),
    );

    return response.data;
  }

  /**
   * GENERATE SDK TOKEN - Generates SDK token for client-side verification
   */
  private async generateSdkToken(applicantId: string) {
    const sdkTokenData = {
      applicant_id: applicantId,
      referrer: process.env.PUBLIC_APP_URL || 'https://gohappygo.fr',
    };

    this.logger.log(`Generating SDK token for applicant ${applicantId}`);

    const response = await firstValueFrom(
      this.http.post(`${this.baseUrl}/sdk_token`, sdkTokenData, {
        headers: { 
          'Authorization': `Token token=${this.apiToken}`,
          'Content-Type': 'application/json'
        },
      }),
    );

    return response.data.token;
  }

  /**
   * VERIFY WEBHOOK SIGNATURE - Ensures webhook is from Onfido
   */
  verifyWebhookSignature(rawBody: string, signature: string) {
    // Onfido uses HMAC SHA256 for webhook signature verification
    const hmac = crypto.createHmac('sha256', this.webhookToken);
    hmac.update(rawBody, 'utf8');
    const digest = hmac.digest('hex');
    
    // Compare our calculated signature with the one sent by Onfido
    if (digest !== signature) {
      this.logger.error('Invalid webhook signature received');
      throw new UnauthorizedException('Invalid webhook signature');
    }
    
    this.logger.log('Webhook signature verified successfully');
  }

  /**
   * HANDLE WEBHOOK - Process status updates from Onfido
   */
  async handleWebhook(rawBody: string, signature: string) {
    this.logger.log('Received webhook from Onfido');
    
    // First, verify the webhook is authentic
    this.verifyWebhookSignature(rawBody, signature);
    
    // Parse the webhook payload
    const event = JSON.parse(rawBody);
    this.logger.log(`Processing webhook event: ${JSON.stringify(event)}`);
    
    // Extract workflow run ID and status from the webhook
    const workflowRunId = event.resource?.id || event.workflow_run_id;
    const status = (event.resource?.status || event.status || '').toLowerCase();
    
    if (!workflowRunId) {
      this.logger.error('Webhook missing workflow run ID');
      return;
    }

    // Find the user associated with this workflow run
    const user = await this.users.findOne({ where: { kycReference: workflowRunId } });
    if (!user) {
      this.logger.warn(`No user found for workflow run ID: ${workflowRunId}`);
      return;
    }

    this.logger.log(`Updating KYC status for user ${user.id} to: ${status}`);

    // Map Onfido status to our internal status
    const map = (s: string) => {
      switch (s) {
        case 'completed': return 'approved';
        case 'failed': return 'failed';
        case 'cancelled': return 'rejected';
        case 'in_progress': return 'pending';
        case 'awaiting_input': return 'pending';
        default: return 'pending'; // Default to pending for unknown statuses
      }
    };
    
    const finalStatus = map(status);
    const previousStatus = user.kycStatus;

    // Update user's KYC status in our database
    await this.users.update(user.id, {
      kycStatus: finalStatus as any,
      isVerified: finalStatus === 'approved',
      kycUpdatedAt: new Date(),
    });

    this.logger.log(`User ${user.id} KYC status updated to: ${finalStatus}`);

    // Emit KYC completed event if status changed to final state
    if (finalStatus !== previousStatus && ['approved', 'rejected', 'failed'].includes(finalStatus)) {
      this.userEventsService.emitKycCompleted(user, workflowRunId, finalStatus as any, 'onfido', event.resource?.result || null);
    }
  }

  /**
   * GET KYC STATUS - Retrieve current KYC status for a user
   */
  async getStatus(userId: number) {
    this.logger.log(`Getting KYC status for user ${userId}`);
    
    const user = await this.users.findOne({ where: { id: userId } });
    
    if (!user) {
      this.logger.warn(`User ${userId} not found`);
      return { 
        kycStatus: 'uninitiated', 
        kycUpdatedAt: null,
        message: 'User not found'
      };
    }

    const status = {
      kycStatus: user.kycStatus || 'uninitiated',
      kycUpdatedAt: user.kycUpdatedAt || null,
      kycProvider: user.kycProvider || null,
      isVerified: user.isVerified || false
    };

    this.logger.log(`User ${userId} KYC status: ${status.kycStatus}`);
    
    return status;
  }

  /**
   * GET WORKFLOW RUN DETAILS - Retrieve detailed information about a KYC session
   */
  async getWorkflowRunDetails(userId: number) {
    const user = await this.users.findOne({ where: { id: userId } });
    
    if (!user || !user.kycReference) {
      return { message: 'No active KYC session found' };
    }

    try {
      // Fetch workflow run details from Onfido API
      const resp = await firstValueFrom(
        this.http.get(`${this.baseUrl}/workflow_runs/${user.kycReference}`, {
          headers: { 
            'Authorization': `Token token=${this.apiToken}`,
          },
        }),
      );

      return {
        workflowRunId: user.kycReference,
        kycStatus: user.kycStatus,
        workflowRunStatus: resp.data.status,
        applicantId: resp.data.applicant_id,
        provider: user.kycProvider,
        updatedAt: user.kycUpdatedAt,
        onfidoDetails: resp.data
      };
    } catch (error) {
      this.logger.error(`Failed to fetch workflow run details: ${error.message}`);
      return {
        workflowRunId: user.kycReference,
        kycStatus: user.kycStatus,
        provider: user.kycProvider,
        updatedAt: user.kycUpdatedAt,
        error: 'Could not fetch additional details from Onfido'
      };
    }
  }
}
