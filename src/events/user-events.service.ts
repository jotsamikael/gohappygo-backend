import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserEntity } from 'src/user/user.entity';
import { UserEventType } from './event-types';
import { RequestEntity } from 'src/request/request.entity';

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
  requestId: number;
  requestType: 'GoAndGo' | 'GoAndGive';
  weight: number | null;
  isForOwner: boolean;

 
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

  constructor(private readonly eventEmitter: EventEmitter2) {}

  // Authentication Events
  emitUserRegistered(user: UserEntity): void {
    const event: UserRegisteredEvent = {
      userId: user.id,
      userFirstName: user.firstName,
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
      userFirstName: user.firstName,
      userEmail: user.email,
      timestamp: new Date(),
      metadata: { ipAddress, userAgent: 'web' },
    };
    this.eventEmitter.emit(UserEventType.USER_LOGGED_IN, event);
  }

  emitPasswordChanged(user: UserEntity): void {
    const event: BaseUserEvent = {
      userId: user.id,
      userFirstName: user.firstName,
      userEmail: user.email,
      timestamp: new Date(),
    };
    this.eventEmitter.emit(UserEventType.PASSWORD_CHANGED, event);
  }

  // Verification Events
  emitPhoneVerificationRequested(user: UserEntity, phoneNumber: string): void {
    const event: PhoneVerificationEvent = {
      userId: user.id,
      userFirstName: user.firstName,
      userEmail: user.email,
      timestamp: new Date(),
      phoneNumber,
    };
    this.eventEmitter.emit(UserEventType.PHONE_VERIFICATION_REQUESTED, event);
  }

  emitPhoneVerified(user: UserEntity, phoneNumber: string): void {
    const event: PhoneVerificationEvent = {
      userId: user.id,
      userFirstName: user.firstName,

      userEmail: user.email,
      timestamp: new Date(),
      phoneNumber,
    };
    this.eventEmitter.emit(UserEventType.PHONE_VERIFIED, event);
  }

  emitEmailVerified(user: UserEntity, email: string): void {
    const event: EmailVerificationEvent = {
      userId: user.id,
      userFirstName: user.firstName,

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
      userFirstName: user.firstName,
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
      userFirstName: user.firstName,
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

  // Demand Events
  emitDemandPublished(user: UserEntity, demandData: any): void {
    const event: DemandEvent = {
      userId: user.id,
      userFirstName: user.firstName,
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

  // Request Events
  emitRequestCreated(user: UserEntity, requestData: any, isForOwner: boolean, ownerId: number): void {
    // Determine requester name from available data
    let requesterName = 'Unknown User';
    if (requestData.requester) {
      requesterName = `${requestData.requester.firstName} ${requestData.requester.lastName.charAt(0)}.`;
    } else if (!isForOwner) {
      // If not for owner, the user is the requester
      requesterName = `${user.firstName} ${user.lastName.charAt(0)}.`;
    }

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: user.firstName,
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

  emitRequestAccepted(user: UserEntity, requestData: any, isForOwner: boolean, ownerId?: number): void {
    // Determine requester name from available data
    let requesterName = 'Unknown User';
    if (requestData.requester) {
      requesterName = `${requestData.requester.firstName} ${requestData.requester.lastName.charAt(0)}.`;
    }

    // If ownerId not provided, try to get from travel or demand
    const finalOwnerId = ownerId || requestData.travel?.userId || requestData.demand?.userId || 0;

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: user.firstName,
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
      userFirstName: user.firstName,

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
      userFirstName: user.firstName,

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
      userFirstName: user.firstName,

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
      userFirstName: user.firstName,

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
      userFirstName: user.firstName,

      userEmail: user.email,
      timestamp: new Date(),
      metadata: { activity, severity: 'medium' },
    };
    this.eventEmitter.emit(UserEventType.SUSPICIOUS_ACTIVITY, event);
  }


  emitRequestCompletedForOwner(user: UserEntity, updatedRequest: RequestEntity, isForOwner: boolean) {
    // Determine requester name from available data
    let requesterName = 'Unknown User';
    if (updatedRequest.requester) {
      requesterName = `${updatedRequest.requester.firstName} ${updatedRequest.requester.lastName.charAt(0)}.`;
    }

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: user.firstName,
      isForOwner: isForOwner,
      requesterId: updatedRequest.requesterId,
      requesterName: requesterName,
      ownerId: user.id,
      userEmail: user.email,
      timestamp: new Date(),
      requestId: updatedRequest.id,
      requestType: updatedRequest.requestType,
      weight: updatedRequest.weight,
     
    };
    this.eventEmitter.emit(UserEventType.REQUEST_COMPLETED, event);
  }

  emitRequestCompleted(user: UserEntity, updatedRequest: RequestEntity, isForOwner: boolean) {
    // Determine requester name from available data
    let requesterName = 'Unknown User';
    if (updatedRequest.requester) {
      requesterName = `${updatedRequest.requester.firstName} ${updatedRequest.requester.lastName.charAt(0)}.`;
    }

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: user.firstName,
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

  emitRequestCancelled(user: UserEntity, requestData: RequestEntity, isForOwner: boolean, ownerId: number): void {
    // Determine requester name from available data
    let requesterName = 'Unknown User';
    if (requestData.requester) {
      requesterName = `${requestData.requester.firstName} ${requestData.requester.lastName.charAt(0)}.`;
    }

    const event: RequestEvent = {
      userId: user.id,
      userFirstName: user.firstName,
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
    this.eventEmitter.emit(UserEventType.REQUEST_CANCELLED, event);
  }

  // KYC Events
  emitKycStarted(user: UserEntity, sessionId: string, redirectUrl: string, provider: string): void {
    const event: KycStartedEvent = {
      userId: user.id,
      userFirstName: user.firstName,
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
      userFirstName: user.firstName,
      userEmail: user.email,
      timestamp: new Date(),
      sessionId,
      status,
      provider,
      reason,
    };

    this.eventEmitter.emit(UserEventType.KYC_COMPLETED, event);
  }
}