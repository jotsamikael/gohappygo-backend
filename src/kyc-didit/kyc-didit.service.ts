import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { UserEntity } from '../user/user.entity';
import { UserEventsService } from '../events/user-events.service';
import * as crypto from 'crypto';

@Injectable()
export class KycDiditService {
  private readonly logger = new Logger(KycDiditService.name);
  
  // Environment variables for Didit API configuration
  private apiKey = process.env.DIDIT_API_KEY!;
  private baseUrl = process.env.DIDIT_BASE_URL || 'https://verification.didit.me'; // Updated base URL
  private webhookSecret = process.env.DIDIT_WEBHOOK_SECRET_KEY!;
  private returnUrl = process.env.KYC_RETURN_URL || `${process.env.PUBLIC_APP_URL}/kyc/return`;
  private workflowID = process.env.DIDIT_WORKFLOW_ID!;
  
  constructor(
    private readonly http: HttpService,
    @InjectRepository(UserEntity) private users: Repository<UserEntity>,
    private readonly userEventsService: UserEventsService,
  ) {}

  /**
   * START KYC PROCESS - Creates a new verification session with Didit
   */
  async start(user: UserEntity) {
    this.logger.log(`Starting KYC process for user ${user.id} (${user.email})`);
    
    // Add debugging
    console.log('Environment check:');
    console.log('DIDIT_API_KEY:', process.env.DIDIT_API_KEY ? 'Set' : 'Not set');
    console.log('DIDIT_BASE_URL:', process.env.DIDIT_BASE_URL);
    console.log('DIDIT_WORKFLOW_ID:', process.env.DIDIT_WORKFLOW_ID);
    
    // Prepare the payload for Didit session creation
    const payload = {
      // Use the workflowID variable
      workflow_id: this.workflowID,
      
      // Required: vendor_data - your user identifier
      vendor_data: user.id.toString(),
      
      // WEBHOOK URL - This is where Didit sends status updates (BACKEND)
      callback: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/kyc/webhook`,
      
      // RETURN URL - This is where user returns after completion (FRONTEND)
      return_url: this.returnUrl,
      
      // Optional: metadata
      metadata: {
        user_email: user.email,
        user_name: `${user.firstName} ${user.lastName}`,
        platform: 'gohappygo'
      },
      
      // Optional: contact details
      contact_details: {
        email: user.email,
        email_lang: 'en',
        phone: user.phone
      }
    };
    
    try {
      this.logger.log(`Creating Didit session for user ${user.id}`);
      this.logger.log(`API Key: ${this.apiKey ? 'Set' : 'Not set'}`);
      this.logger.log(`Base URL: ${this.baseUrl}`);
      
      // Make API call to Didit to create a new verification session
      const resp = await firstValueFrom(
        this.http.post(`${this.baseUrl}/v2/session/`, payload, {
          headers: { 
            'X-Api-Key': this.apiKey, // Changed from Authorization to X-Api-Key
            'Content-Type': 'application/json'
          },
        }),
      );
      
      // Extract the session ID and redirect URL from Didit's response
      const verificationId = resp.data?.session_id; // Changed from 'id' to 'session_id'
      const redirectUrl = resp.data?.url;
      
      // Validate that Didit returned the required data
      if (!verificationId || !redirectUrl) {
        this.logger.error(`Invalid response from Didit API: ${JSON.stringify(resp.data)}`);
        throw new BadRequestException('Failed to start KYC with provider');
      }

      this.logger.log(`Didit session created successfully: ${verificationId}`);

      // Update user record with KYC session information
      await this.users.update(user.id, {
        kycProvider: 'didit',
        kycReference: verificationId,
        kycStatus: 'pending',
        kycUpdatedAt: new Date(),
      });

      this.logger.log(`User ${user.id} KYC status updated to pending`);

      // Emit KYC started event (this will trigger email via event listener)
      this.userEventsService.emitKycStarted(user, verificationId, redirectUrl, 'didit');

      return { 
        redirectUrl,
        sessionId: verificationId,
        message: 'KYC session created successfully. Redirect user to complete verification.'
      };
      
    } catch (error) {
      this.logger.error(`Failed to create Didit session for user ${user.id}: ${error.message}`);
      this.logger.error(`Error response: ${JSON.stringify(error.response?.data)}`);
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        throw new BadRequestException('Invalid Didit API credentials');
      } else if (error.response?.status === 400) {
        throw new BadRequestException(`Invalid request to Didit: ${error.response.data?.message || 'Unknown error'}`);
      } else {
        throw new BadRequestException('Failed to start KYC process. Please try again later.');
      }
    }
  }

  /**
   * VERIFY WEBHOOK SIGNATURE - Ensures webhook is from Didit
   * This is critical for security to prevent unauthorized status updates
   */
  verifyWebhookSignature(rawBody: string, signature: string) {
    // Create HMAC SHA256 hash using our webhook secret
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(rawBody, 'utf8');
    const digest = hmac.digest('hex');
    
    // Compare our calculated signature with the one sent by Didit
    if (digest !== signature) {
      this.logger.error('Invalid webhook signature received');
      throw new UnauthorizedException('Invalid webhook signature');
    }
    
    this.logger.log('Webhook signature verified successfully');
  }

  /**
   * HANDLE WEBHOOK - Process status updates from Didit
   * This method is called when Didit sends us updates about verification status
   */
  async handleWebhook(rawBody: string, signature: string) {
    this.logger.log('Received webhook from Didit');
    
    // First, verify the webhook is authentic
    this.verifyWebhookSignature(rawBody, signature);
    
    // Parse the webhook payload
    const event = JSON.parse(rawBody);
    this.logger.log(`Processing webhook event: ${JSON.stringify(event)}`);
    
    // Extract verification session ID and status from the webhook
    const verificationId = event.session_id || event.verification_id || event.id;
    const status = (event.status || '').toLowerCase();
    
    if (!verificationId) {
      this.logger.error('Webhook missing verification ID');
      return;
    }

    // Find the user associated with this verification session
    const user = await this.users.findOne({ where: { kycReference: verificationId } });
    if (!user) {
      this.logger.warn(`No user found for verification ID: ${verificationId}`);
      return;
    }

    this.logger.log(`Updating KYC status for user ${user.id} to: ${status}`);

    // Map Didit status to our internal status
    // This ensures consistency between Didit's statuses and our system
    const map = (s: string) => {
      switch (s) {
        case 'approved': return 'approved';
        case 'rejected': return 'rejected';
        case 'failed': return 'failed';
        case 'pending': return 'pending';
        case 'in review': return 'pending';
        default: return 'failed'; // Default to failed for unknown statuses
      }
    };
    
    const finalStatus = map(status);
    const previousStatus = user.kycStatus;

    // Update user's KYC status in our database
    await this.users.update(user.id, {
      kycStatus: finalStatus as any,
      isVerified: finalStatus === 'approved', // Set isVerified flag for approved users
      kycUpdatedAt: new Date(), // Track when status was last updated
    });

    this.logger.log(`User ${user.id} KYC status updated to: ${finalStatus}`);

    // Emit KYC completed event if status changed to final state
    if (finalStatus !== previousStatus && ['approved', 'rejected', 'failed'].includes(finalStatus)) {
      this.userEventsService.emitKycCompleted(user, verificationId, finalStatus as any, 'didit', event.reason);
    }
  }

  /**
   * GET KYC STATUS - Retrieve current KYC status for a user
   * This is used by the frontend to check verification status
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
   * GET SESSION DETAILS - Retrieve detailed information about a KYC session
   * This can be used for debugging or detailed status reporting
   */
  async getSessionDetails(userId: number) {
    const user = await this.users.findOne({ where: { id: userId } });
    
    if (!user || !user.kycReference) {
      return { message: 'No active KYC session found' };
    }

    try {
      // Optionally, you can fetch additional details from Didit API
      const resp = await firstValueFrom(
        this.http.get(`${this.baseUrl}/v2/session/${user.kycReference}`, {
          headers: { 
            'X-Api-Key': this.apiKey,
          },
        }),
      );

      return {
        sessionId: user.kycReference,
        status: user.kycStatus,
        provider: user.kycProvider,
        updatedAt: user.kycUpdatedAt,
        diditDetails: resp.data
      };
    } catch (error) {
      this.logger.error(`Failed to fetch session details: ${error.message}`);
      return {
        sessionId: user.kycReference,
        status: user.kycStatus,
        provider: user.kycProvider,
        updatedAt: user.kycUpdatedAt,
        error: 'Could not fetch additional details from Didit'
      };
    }
  }
}
