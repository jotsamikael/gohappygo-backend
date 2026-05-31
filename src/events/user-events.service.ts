import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserEntity } from 'src/user/user.entity';
import { UserEventType } from './event-types';
import { RequestEntity } from 'src/request/request.entity';
import { UserService } from 'src/user/user.service';
import { CommonService } from 'src/common/service/common.service';

// Base event interface
export interface BaseUserEvent {
  userId: number;
  userFirstName: string;
  userEmail: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Specific event interfaces
export interface UserRegisteredEvent extends BaseUserEvent {
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface PhoneVerificationEvent extends BaseUserEvent {
  phoneNumber: string;
  verificationCode?: string;
}

export interface VerificationDocumentsEvent extends BaseUserEvent {
  documentTypes: string[];
  fileCount: number;
  notes?: string;
}

export interface VerificationStatusEvent extends BaseUserEvent {
  status: 'approved' | 'rejected';
  reason?: string;
  reviewedBy?: {
    id: number;
    email: string;
  };
}

export interface TravelEvent extends BaseUserEvent {
  travelId: number;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  travelDate: Date;
  weightAvailable: number;
  pricePerKg: number;
  currencySymbol?: string; // Currency symbol (e.g., $, €, £)
}

export interface DemandEvent extends BaseUserEvent {
  demandId: number;
  description: string;
  departureAirport: string;
  arrivalAirport: string;
  deliveryDate: Date;
  weight: number;
  pricePerKg: number;
  currencySymbol?: string; // Currency symbol (e.g., $, €, £)
}

export interface RequestEvent extends BaseUserEvent {
  requesterId: number;
  requesterName: string;
  ownerId: number;
  /** Seller/owner display name (e.g. for admin dispute email when event has no travel/demand relations). */
  ownerName?: string;
  requestId: number;
  requestType: 'GoAndGo' | 'GoAndGive';
  weight: number | null;
  isForOwner: boolean;
  fundStatus?: 'pending_funds' | 'pending_onboarding' | 'released';
  /** When set, request was cancelled due to payment failure (e.g. card declined). Used for buyer notification email. */
  cancellationReason?: string;
  /** When true, payment-failure email was already sent by caller (e.g. request.service); listener should skip sending. */
  emailAlreadySent?: boolean;
}

export interface TransactionEvent extends BaseUserEvent {
  transactionId: number;
  amount: number;
  status: 'pending' | 'paid' | 'refunded' | 'cancelled';
  paymentMethod: string;
}

export interface MessageEvent extends BaseUserEvent {
  messageId: number;
  receiverId: number;
  requestId: number;
  content: string;
}

export interface ReviewEvent extends BaseUserEvent {
  reviewId: number;
  revieweeId: number;
  rating: number;
  comment?: string;
}

export interface EmailVerificationEvent extends BaseUserEvent {
  email: string;
  verificationCode?: string;
}

export interface KycStartedEvent extends BaseUserEvent {
  sessionId: string;
  redirectUrl: string;
  provider: string;
}

export interface KycCompletedEvent extends BaseUserEvent {
  sessionId: string;
  status: 'approved' | 'rejected' | 'failed';
  provider: string;
  reason?: string;
}

@Injectable()
export class UserEventsService {

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly userService: UserService,
    private readonly commonService: CommonService,
  ) {}

  /** Load requester from DB; format display name. Safe when relation/JWT user omits first/last name. */
  private async resolveRequesterDisplayName(requesterId: number | null | undefined): Promise<string> {
    if (requesterId == null || !Number.isFinite(Number(requesterId))) {
      return 'Unknown User';
    }
    const requester = await this.userService.findOne({ id: Number(requesterId) });
    return this.requesterDisplayNameFromEntity(requester);
  }

  private requesterDisplayNameFromEntity(requester: UserEntity | null | undefined): string {
    if (!requester) {
      return 'Unknown User';
    }
    const name = this.commonService.userGreetingName(requester, '');
    return name || 'Unknown User';
  }

  // Authentication Events
  emitUserRegistered(user: UserEntity): void {
    const event: UserRegisteredEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
    this.eventEmitter.emit(UserEventType.USER_REGISTERED, event);
  }

  emitUserLoggedIn(user: UserEntity, ipAddress?: string): void {
    const event: BaseUserEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      metadata: { ipAddress, userAgent: 'web' },
    };
    this.eventEmitter.emit(UserEventType.USER_LOGGED_IN, event);
  }

  emitPasswordChanged(user: UserEntity): void {
    const event: BaseUserEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
    };
    this.eventEmitter.emit(UserEventType.PASSWORD_CHANGED, event);
  }

  // Verification Events
  emitPhoneVerificationRequested(user: UserEntity, phoneNumber: string): void {
    const event: PhoneVerificationEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      phoneNumber,
    };
    this.eventEmitter.emit(UserEventType.PHONE_VERIFICATION_REQUESTED, event);
  }

  emitPhoneVerified(user: UserEntity, phoneNumber: string): void {
    const event: PhoneVerificationEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),

      userEmail: user.email,
      timestamp: new Date(),
      phoneNumber,
    };
    this.eventEmitter.emit(UserEventType.PHONE_VERIFIED, event);
  }

  emitEmailVerified(user: UserEntity, email: string): void {
    const event: EmailVerificationEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),

      userEmail: user.email,
      timestamp: new Date(),
      email,
    };
    this.eventEmitter.emit(UserEventType.EMAIL_VERIFIED, event);
  }

  emitVerificationDocumentsUploaded(
    user: UserEntity, 
    documentTypes: string[], 
    fileCount: number,
    notes?: string
  ): void {
    const event: VerificationDocumentsEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      documentTypes,
      fileCount,
      notes,
    };
    this.eventEmitter.emit(UserEventType.VERIFICATION_DOCUMENTS_UPLOADED, event);
  }

  // Add this method to emit verification status changes
  emitVerificationStatusChanged(
    user: UserEntity, 
    status: 'approved' | 'rejected', 
    reason?: string, 
    admin?: UserEntity
  ): void {
    this.eventEmitter.emit('user.verification.status.changed', {
      user,
      status,
      reason,
      admin,
      timestamp: new Date()
    });
  }

  // Travel Events
  emitTravelPublished(user: UserEntity, travelData: any): void {
    const event: TravelEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      travelId: travelData.id,
      flightNumber: travelData.flightNumber,
      departureAirport: travelData.departureAirport?.name || 'Unknown',
      arrivalAirport: travelData.arrivalAirport?.name || 'Unknown',
      travelDate: travelData.departureDatetime || travelData.travelDate,
      weightAvailable: travelData.weightAvailable,
      pricePerKg: travelData.pricePerKg || 0,
      currencySymbol: travelData.currency?.symbol || '$', // Use currency symbol, default to $ if not available
    };
    this.eventEmitter.emit(UserEventType.TRAVEL_PUBLISHED, event);
  }

  emitTravelUpdated(user: UserEntity, travelData: any): void {
    const event: TravelEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      travelId: travelData.id,
      flightNumber: travelData.flightNumber,
      departureAirport: travelData.departureAirport?.name || 'Unknown',
      arrivalAirport: travelData.arrivalAirport?.name || 'Unknown',
      travelDate: travelData.travelDate || travelData.departureDatetime,
      weightAvailable: travelData.weightAvailable,
      pricePerKg: travelData.pricePerKg || 0,
      currencySymbol: travelData.currency?.symbol || '$',
    };
    this.eventEmitter.emit(UserEventType.TRAVEL_UPDATED, event);
  }

  emitTravelCancelled(user: UserEntity, travelData: any): void {
    const event: TravelEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      travelId: travelData.id,
      flightNumber: travelData.flightNumber,
      departureAirport: travelData.departureAirport?.name || 'Unknown',
      arrivalAirport: travelData.arrivalAirport?.name || 'Unknown',
      travelDate: travelData.travelDate || travelData.departureDatetime,
      weightAvailable: travelData.weightAvailable,
      pricePerKg: travelData.pricePerKg || 0,
      currencySymbol: travelData.currency?.symbol || '$',
    };
    this.eventEmitter.emit(UserEventType.TRAVEL_CANCELLED, event);
  }

  // Demand Events
  emitDemandPublished(user: UserEntity, demandData: any): void {
    const event: DemandEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      demandId: demandData.id,
      weight: demandData.weight,
      pricePerKg: demandData.pricePerKg,
      description: demandData.description, // Changed from demandData.title to demandData.description
      departureAirport: demandData.departureAirport?.name || 'Unknown', // Changed from originAirport to departureAirport
      arrivalAirport: demandData.arrivalAirport?.name || 'Unknown', // Changed from destinationAirport to arrivalAirport
      deliveryDate: demandData.travelDate, // Changed from demandData.deliveryDate to demandData.travelDate
      currencySymbol: demandData.currency?.symbol || '$', // Use currency symbol, default to $ if not available
    };
    this.eventEmitter.emit(UserEventType.DEMAND_PUBLISHED, event);
  }

  emitDemandUpdated(user: UserEntity, demandData: any): void {
    const event: DemandEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      demandId: demandData.id,
      weight: demandData.weight,
      pricePerKg: demandData.pricePerKg,
      description: demandData.description,
      departureAirport: demandData.departureAirport?.name || 'Unknown',
      arrivalAirport: demandData.arrivalAirport?.name || 'Unknown',
      deliveryDate: demandData.travelDate || demandData.deliveryDate,
      currencySymbol: demandData.currency?.symbol || '$',
    };
    this.eventEmitter.emit(UserEventType.DEMAND_UPDATED, event);
  }

  emitDemandCancelled(user: UserEntity, demandData: any): void {
    const event: DemandEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      demandId: demandData.id,
      weight: demandData.weight,
      pricePerKg: demandData.pricePerKg,
      description: demandData.description,
      departureAirport: demandData.departureAirport?.name || 'Unknown',
      arrivalAirport: demandData.arrivalAirport?.name || 'Unknown',
      deliveryDate: demandData.travelDate || demandData.deliveryDate,
      currencySymbol: demandData.currency?.symbol || '$',
    };
    this.eventEmitter.emit(UserEventType.DEMAND_CANCELLED, event);
  }

  // Request Events
  async emitRequestCreated(
    user: UserEntity,
    requestData: any,
    isForOwner: boolean,
    ownerId: number,
  ): Promise<void> {
    const requesterName = await this.resolveRequesterDisplayName(requestData.requesterId);

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      isForOwner: isForOwner,
      userEmail: user.email,
      requesterId: requestData.requesterId,
      requesterName: requesterName,
      ownerId: ownerId,
      timestamp: new Date(),
      requestId: requestData.id,
      requestType: requestData.requestType,
      weight: requestData.weight,
    };
    this.eventEmitter.emit(UserEventType.REQUEST_CREATED, event);
  }

  async emitRequestAccepted(
    user: UserEntity,
    requestData: any,
    isForOwner: boolean,
    ownerId?: number,
  ): Promise<void> {
    const requesterName = await this.resolveRequesterDisplayName(requestData.requesterId);

    // If ownerId not provided, try to get from travel or demand
    const finalOwnerId = ownerId || requestData.travel?.userId || requestData.demand?.userId || 0;

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      isForOwner: isForOwner,
      userEmail: user.email,
      requesterId: requestData.requesterId,
      requesterName: requesterName,
      ownerId: finalOwnerId,
      weight: requestData.weight,
      timestamp: new Date(),
      requestId: requestData.id,
      requestType: requestData.requestType,
    };
    this.eventEmitter.emit(UserEventType.REQUEST_ACCEPTED, event);
  }

  // Transaction Events
  emitTransactionCreated(user: UserEntity, transactionData: any): void {
    const event: TransactionEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),

      userEmail: user.email,
      timestamp: new Date(),
      transactionId: transactionData.id,
      amount: transactionData.amount,
      status: transactionData.status,
      paymentMethod: transactionData.paymentMethod,
    };
    this.eventEmitter.emit(UserEventType.TRANSACTION_CREATED, event);
  }

  emitTransactionCompleted(user: UserEntity, transactionData: any): void {
    const event: TransactionEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),

      userEmail: user.email,
      timestamp: new Date(),
      transactionId: transactionData.id,
      amount: transactionData.amount,
      status: transactionData.status,
      paymentMethod: transactionData.paymentMethod,
    };
    this.eventEmitter.emit(UserEventType.TRANSACTION_COMPLETED, event);
  }

  // Message Events
  emitMessageSent(user: UserEntity, messageData: any): void {
    const event: MessageEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),

      userEmail: user.email,
      timestamp: new Date(),
      messageId: messageData.id,
      receiverId: messageData.receiverId,
      requestId: messageData.requestId,
      content: messageData.content,
    };
    this.eventEmitter.emit(UserEventType.MESSAGE_SENT, event);
  }

  // Review Events
  emitReviewPosted(user: UserEntity, reviewData: any): void {
    const event: ReviewEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),

      userEmail: user.email,
      timestamp: new Date(),
      reviewId: reviewData.id,
      revieweeId: reviewData.revieweeId,
      rating: reviewData.rating,
      comment: reviewData.comment,
    };
    this.eventEmitter.emit(UserEventType.REVIEW_POSTED, event);
  }

  // Security Events
  emitSuspiciousActivity(user: UserEntity, activity: string): void {
    const event: BaseUserEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),

      userEmail: user.email,
      timestamp: new Date(),
      metadata: { activity, severity: 'medium' },
    };
    this.eventEmitter.emit(UserEventType.SUSPICIOUS_ACTIVITY, event);
  }


  emitRequestCompletedForOwner(user: UserEntity, updatedRequest: RequestEntity, isForOwner: boolean, fundStatus?: 'pending_funds' | 'pending_onboarding' | 'released') {
    const requesterName = this.requesterDisplayNameFromEntity(updatedRequest.requester);

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      isForOwner: isForOwner,
      requesterId: updatedRequest.requesterId,
      requesterName: requesterName,
      ownerId: user.id,
      userEmail: user.email,
      timestamp: new Date(),
      requestId: updatedRequest.id,
      requestType: updatedRequest.requestType,
      weight: updatedRequest.weight,
      fundStatus,
    };
    this.eventEmitter.emit(UserEventType.REQUEST_COMPLETED, event);
  }

  emitRequestCompleted(user: UserEntity, updatedRequest: RequestEntity, isForOwner: boolean) {
    const requesterName = this.requesterDisplayNameFromEntity(updatedRequest.requester);

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      isForOwner: isForOwner,
      requesterId: updatedRequest.requesterId || 0,
      requesterName: requesterName,
      ownerId: updatedRequest.travel?.userId || updatedRequest.demand?.userId || 0,
      userEmail: user.email,
      timestamp: new Date(),
      requestId: updatedRequest.id,
      requestType: updatedRequest.requestType,
      weight: updatedRequest.weight,
    
    };
    this.eventEmitter.emit(UserEventType.REQUEST_COMPLETED, event);
  }

  emitRequestCancelled(
    user: UserEntity,
    requestData: RequestEntity,
    isForOwner: boolean,
    ownerId: number,
    cancellationReason?: string,
    emailAlreadySent?: boolean,
  ): void {
    const requesterName = this.requesterDisplayNameFromEntity(requestData.requester);

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      isForOwner: isForOwner,
      requesterId: requestData.requesterId,
      requesterName: requesterName,
      ownerId: ownerId,
      userEmail: user.email,
      timestamp: new Date(),
      requestId: requestData.id,
      requestType: requestData.requestType,
      weight: requestData.weight,
      ...(cancellationReason && { cancellationReason }),
      ...(emailAlreadySent && { emailAlreadySent }),
    };
    this.eventEmitter.emit(UserEventType.REQUEST_CANCELLED, event);
  }

  emitRequestRejected(user: UserEntity, requestData: RequestEntity, isForOwner: boolean, ownerId: number): void {
    const requesterName = this.requesterDisplayNameFromEntity(requestData.requester);

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      isForOwner: isForOwner,
      requesterId: requestData.requesterId,
      requesterName: requesterName,
      ownerId: ownerId,
      userEmail: user.email,
      timestamp: new Date(),
      requestId: requestData.id,
      requestType: requestData.requestType,
      weight: requestData.weight,
    };
    this.eventEmitter.emit(UserEventType.REQUEST_REJECTED, event);
  }

  // KYC Events
  emitKycStarted(user: UserEntity, sessionId: string, redirectUrl: string, provider: string): void {
    const event: KycStartedEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      sessionId,
      redirectUrl,
      provider,
    };

    this.eventEmitter.emit(UserEventType.KYC_STARTED, event);
  }

  emitKycCompleted(
    user: UserEntity, 
    sessionId: string, 
    status: 'approved' | 'rejected' | 'failed', 
    provider: string,
    reason?: string
  ): void {
    const event: KycCompletedEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      sessionId,
      status,
      provider,
      reason,
    };

    this.eventEmitter.emit(UserEventType.KYC_COMPLETED, event);
  }

  emitCancellationConfirmationRequested(user: UserEntity, requestData: RequestEntity, ownerId: number): void {
    const requesterName = this.requesterDisplayNameFromEntity(requestData.requester);

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      requesterId: requestData.requesterId,
      requesterName: requesterName,
      ownerId: ownerId,
      requestId: requestData.id,
      requestType: requestData.requestType,
      weight: requestData.weight,
      isForOwner: true,
    };
    this.eventEmitter.emit(UserEventType.CANCELLATION_CONFIRMATION_REQUESTED, event);
  }

  /** @param user Buyer (requester) — confirmation email is sent to this user via the event listener. */
  emitCancellationConfirmed(user: UserEntity, requestData: RequestEntity, ownerId: number): void {
    const requesterName = this.requesterDisplayNameFromEntity(requestData.requester);

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      requesterId: requestData.requesterId,
      requesterName: requesterName,
      ownerId: ownerId,
      requestId: requestData.id,
      requestType: requestData.requestType,
      weight: requestData.weight,
      isForOwner: false,
    };
    this.eventEmitter.emit(UserEventType.CANCELLATION_CONFIRMED, event);
  }

  emitCancellationDisputed(user: UserEntity, requestData: RequestEntity, ownerId: number): void {
    const requesterName = this.requesterDisplayNameFromEntity(requestData.requester);

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      requesterId: requestData.requesterId,
      requesterName: requesterName,
      ownerId: ownerId,
      requestId: requestData.id,
      requestType: requestData.requestType,
      weight: requestData.weight,
      isForOwner: false,
    };
    this.eventEmitter.emit(UserEventType.CANCELLATION_DISPUTED, event);
  }

  emitRequestAutoCompleted(user: UserEntity, requestData: RequestEntity, isForOwner: boolean, ownerId: number): void {
    const requesterName = this.requesterDisplayNameFromEntity(requestData.requester);

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: this.commonService.userGreetingName(user),
      userEmail: user.email,
      timestamp: new Date(),
      requesterId: requestData.requesterId,
      requesterName: requesterName,
      ownerId: ownerId,
      requestId: requestData.id,
      requestType: requestData.requestType,
      weight: requestData.weight,
      isForOwner: isForOwner,
    };
    this.eventEmitter.emit(UserEventType.REQUEST_AUTO_COMPLETED, event);
  }
}