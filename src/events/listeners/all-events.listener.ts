import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { UserEventType } from '../event-types';
import { 
  UserRegisteredEvent,
  PhoneVerificationEvent, 
  VerificationDocumentsEvent, 
  VerificationStatusEvent,
  TravelEvent,
  DemandEvent,
  TransactionEvent,
  RequestEvent
} from '../user-events.service';
import { EmailService } from '../../email/email.service';
import { EmailTemplatesService } from '../../email/email-templates.service';
import { KycStartedEvent, KycCompletedEvent } from '../user-events.service';

@Injectable()
export class AllEventsListener {
  private readonly logger = new Logger(AllEventsListener.name);

  constructor(
    private emailService: EmailService,
    private emailTemplatesService: EmailTemplatesService,
    private configService: ConfigService,

  ) {
  }



  // User Registration
  @OnEvent('user.registered')
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    const {user, timestamp} = event;
    this.logger.log(`Welcome, ${user.email}! Account created at ${timestamp.toISOString()}`);
    
 // Debug log to verify the email being passed
 this.logger.log(`Sending welcome email to: ${user.email}`);
  

    // Send welcome email
    await this.emailService.sendWelcomeEmail(user.email, event.userFirstName);
  }

  // Verification Events
  @OnEvent(UserEventType.PHONE_VERIFICATION_REQUESTED)
  async handlePhoneVerificationRequested(event: PhoneVerificationEvent): Promise<void> {
    this.logger.log(`Phone verification requested for ${event.userEmail} - ${event.phoneNumber}`);
    
   
    // TODO: send confirmation code by sms
    //For now, send email to verified user
    await this.emailService.sendPhoneVerificationEmail(event.userEmail, 'User', event.verificationCode!);
    
  }

  @OnEvent(UserEventType.PHONE_VERIFIED)
  async handlePhoneVerified(event: PhoneVerificationEvent): Promise<void> {
    this.logger.log(`Phone verified for ${event.userEmail} - ${event.phoneNumber}`);
  }

  @OnEvent(UserEventType.VERIFICATION_DOCUMENTS_UPLOADED)
  async handleVerificationDocumentsUploaded(event: VerificationDocumentsEvent): Promise<void> {
    this.logger.log(`Documents uploaded for ${event.userEmail} - ${event.documentTypes.join(', ')}`);
    
    // Send confirmation email
    await this.emailService.sendVerificationDocumentsReceived(event.userEmail, event.userFirstName || 'User');
  }

  @OnEvent(UserEventType.VERIFICATION_APPROVED)
  async handleVerificationApproved(event: VerificationStatusEvent): Promise<void> {
    this.logger.log(`Verification approved for ${event.userEmail} by ${event.reviewedBy?.email || 'Unknown'}`);
    
    // Send approval email
    await this.emailService.sendVerificationApproved(event.userEmail, 'User');
  }

  @OnEvent(UserEventType.VERIFICATION_REJECTED)
  async handleVerificationRejected(event: VerificationStatusEvent): Promise<void> {
    this.logger.log(`Verification rejected for ${event.userEmail} - Reason: ${event.reason}`);
    
    // Send rejection email
    await this.emailService.sendVerificationRejected(event.userEmail, 'User', event.reason || 'Documents do not meet requirements');
  }

  // Travel & Demand Events
  @OnEvent(UserEventType.TRAVEL_PUBLISHED)
  async handleTravelPublished(event: TravelEvent): Promise<void> {
    this.logger.log(`Travel published by ${event.userEmail} - ${event.flightNumber}`);
    
    // Send confirmation email
    await this.emailService.sendTravelPublishedConfirmation(event.userEmail, event.userFirstName, event);
  }

  @OnEvent(UserEventType.DEMAND_PUBLISHED)
  async handleDemandPublished(event: DemandEvent): Promise<void> {
    this.logger.log(`Demand published by ${event.userEmail} - ${event.description}`);
    
    // Send confirmation email
    await this.emailService.sendDemandPublishedConfirmation(event.userEmail, event.userFirstName, event);
  }

  @OnEvent(UserEventType.REQUEST_CREATED)
  async handleRequestCreated(event: RequestEvent): Promise<void> {
    this.logger.log(`Request created by ${event.userEmail} - ${event.requestType}`);
    if(event.isForOwner){
    await this.emailService.sendRequestCreatedForOwnerConfirmation(event.userEmail, event.userFirstName, event);
    }else{
      await this.emailService.sendRequestCreatedConfirmation(event.userEmail, event.userFirstName, event);
    }

  }

  @OnEvent(UserEventType.REQUEST_ACCEPTED)
  async handleRequestAccepted(event: RequestEvent): Promise<void> {
    this.logger.log(`Request accepted by ${event.userEmail} - ${event.requestType}`);
    if(event.isForOwner){
      await this.emailService.sendRequestAcceptedForOwnerConfirmation(event.userEmail, event.userFirstName, event);
    }else{
      await this.emailService.sendRequestAcceptedConfirmation(event.userEmail, event.userFirstName, event);
    }
  }

  @OnEvent(UserEventType.REQUEST_COMPLETED)
  async handleRequestCompleted(event: RequestEvent): Promise<void> {
    this.logger.log(`Request completed by ${event.userEmail} - ${event.requestType}`);
    if(event.isForOwner){
      await this.emailService.sendRequestCompletedForOwnerConfirmation(event.userEmail, event.userFirstName, event, event.fundStatus);
    }else{
      await this.emailService.sendRequestCompletedConfirmation(event.userEmail, event.userFirstName, event);
    }
  }

  @OnEvent(UserEventType.REQUEST_CANCELLED)
  async handleRequestCancelled(event: RequestEvent): Promise<void> {
    this.logger.log(`Request cancelled - ${event.requestType} - Request ID: ${event.requestId}`);
    // Send email to requester (isForOwner=false means this is for the requester)
    if (!event.isForOwner) {
      // Skip if caller already sent payment-failure email (e.g. cancelRequestDueToPaymentFailure)
      if (event.cancellationReason && event.emailAlreadySent) {
        return;
      }
      if (event.cancellationReason) {
        await this.emailService.sendRequestCancelledDueToPaymentFailureConfirmation(
          event.userEmail,
          event.userFirstName,
          event,
          event.cancellationReason,
        );
      } else {
        await this.emailService.sendRequestCancelledConfirmation(event.userEmail, event.userFirstName, event);
      }
    } else {
      // Send email to travel/demand owner (isForOwner=true means this is for the owner)
      await this.emailService.sendRequestCancelledForOwnerConfirmation(event.userEmail, event.userFirstName, event);
    }
  }

  @OnEvent(UserEventType.REQUEST_REJECTED)
  async handleRequestRejected(event: RequestEvent): Promise<void> {
    this.logger.log(`Request rejected - ${event.requestType} - Request ID: ${event.requestId}`);
    // Send email to requester (isForOwner=false means this is for the requester)
    if (!event.isForOwner) {
      await this.emailService.sendRequestRejectedConfirmation(event.userEmail, event.userFirstName, event);
    } else {
      // Send email to travel/demand owner (isForOwner=true means this is for the owner)
      await this.emailService.sendRequestRejectedForOwnerConfirmation(event.userEmail, event.userFirstName, event);
    }
  }

  // Transaction Events
  @OnEvent(UserEventType.TRANSACTION_CREATED)
  async handleTransactionCreated(event: TransactionEvent): Promise<void> {
    this.logger.log(`Transaction created for ${event.userEmail} - $${event.amount}`);
  }

  @OnEvent(UserEventType.TRANSACTION_COMPLETED)
  async handleTransactionCompleted(event: TransactionEvent): Promise<void> {
    this.logger.log(`Transaction completed for ${event.userEmail} - $${event.amount}`);
    
    // Send completion email
    await this.emailService.sendTransactionCompleted(event.userEmail, 'User', event);
  }

  // KYC Events
  @OnEvent(UserEventType.KYC_STARTED)
  async handleKycStarted(event: KycStartedEvent): Promise<void> {
    this.logger.log(`KYC started for user ${event.userEmail}`);
    
    const subject = 'KYC Verification Started - GoHappyGo';
    const html = this.emailTemplatesService.getKycStartedTemplate(
      event.userFirstName, 
      event.redirectUrl, 
      event.sessionId
    );
    
    await this.emailService.sendEmail({
      to: event.userEmail,
      subject,
      html,
    });
  }

  @OnEvent(UserEventType.KYC_COMPLETED)
  async handleKycCompleted(event: KycCompletedEvent): Promise<void> {
    this.logger.log(`KYC completed for user ${event.userEmail} - Status: ${event.status}`);
    
    const isApproved = event.status === 'approved';
    const subject = isApproved 
      ? '✅ KYC Verification Approved - GoHappyGo' 
      : '❌ KYC Verification Not Approved - GoHappyGo';
    
    const html = this.emailTemplatesService.getKycCompletedTemplate(
      event.userFirstName, 
      event.status, 
      event.sessionId,
      event.reason
    );
    
    await this.emailService.sendEmail({
      to: event.userEmail,
      subject,
      html,
    });
  }

  @OnEvent(UserEventType.CANCELLATION_CONFIRMATION_REQUESTED)
  async handleCancellationConfirmationRequested(event: RequestEvent): Promise<void> {
    this.logger.log(`Cancellation confirmation requested - Request ID: ${event.requestId}`);
    // Send email to seller (isForOwner=true means this is for the owner/seller)
    if (event.isForOwner) {
      await this.emailService.sendCancellationConfirmationRequest(event.userEmail, event.userFirstName, event);
    }
  }

  @OnEvent(UserEventType.CANCELLATION_CONFIRMED)
  async handleCancellationConfirmed(event: RequestEvent): Promise<void> {
    this.logger.log(`Cancellation confirmed - Request ID: ${event.requestId}`);
    // Send email to buyer (isForOwner=false means this is for the requester/buyer)
    if (!event.isForOwner) {
      await this.emailService.sendCancellationConfirmed(event.userEmail, event.userFirstName, event);
    }
  }

  @OnEvent(UserEventType.CANCELLATION_DISPUTED)
  async handleCancellationDisputed(event: RequestEvent): Promise<void> {
    this.logger.log(`Cancellation disputed - Request ID: ${event.requestId}`);
    // Send email to buyer
    if (!event.isForOwner) {
      await this.emailService.sendCancellationDisputed(event.userEmail, event.userFirstName, event);
    }
    
    // Send email to admin using ADMIN_EMAIL env variable
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || "support@gohappygo.fr";
    if (!adminEmail) {
      this.logger.warn('ADMIN_EMAIL is not set; skipping admin notification for disputed cancellation');
      return;
    }

    try {
      await this.emailService.sendAdminCancellationDisputed(
        adminEmail,
        'Admin',
        event,
      );
    } catch (error) {
      this.logger.error(`Failed to send admin notification for disputed cancellation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  @OnEvent(UserEventType.REQUEST_AUTO_COMPLETED)
  async handleRequestAutoCompleted(event: RequestEvent): Promise<void> {
    this.logger.log(`Request auto-completed - Request ID: ${event.requestId}`);
    // Send email to both parties
    await this.emailService.sendAutoCompletionNotification(
      event.userEmail,
      event.userFirstName,
      event,
      event.isForOwner
    );
  }

  @OnEvent(UserEventType.MEETING_PROOF_UPLOADED)
  async handleMeetingProofUploaded(event: RequestEvent): Promise<void> {
    this.logger.log(
      `Meeting proof uploaded for request ${event.requestId} by user ${event.userId}`,
    );
  }

  @OnEvent(UserEventType.PROOF_DEADLINE_MISSED)
  async handleProofDeadlineMissed(event: { requestId: number; requesterId: number }): Promise<void> {
    this.logger.log(
      `Proof deadline missed for request ${event.requestId} (requester ${event.requesterId})`,
    );
  }

  @OnEvent(UserEventType.REQUEST_SETTLED_BY_ADMIN)
  async handleRequestSettledByAdmin(event: {
    requestId: number;
    adminId: number;
    action: string;
  }): Promise<void> {
    this.logger.log(
      `Request ${event.requestId} settled by admin ${event.adminId}: ${event.action}`,
    );
  }

  /**
   * Helper method to get admin users
   */
  private async getAdminUsers(): Promise<any[]> {
    try {
      // This is a simplified version - in production, inject UserService or RoleService
      // For now, we'll use a basic approach
      return [];
    } catch (error) {
      this.logger.error(`Error fetching admin users: ${error.message}`);
      return [];
    }
  }
} 