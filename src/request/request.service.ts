import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestEntity } from './request.entity';
import { EntityManager, FindOptionsWhere, Like, Repository } from 'typeorm';
import { UserEntity, UserRole } from 'src/user/user.entity';
import { RequestStatusHistoryService } from 'src/request-status-history/request-status-history.service';
import { RequestStatusService } from 'src/request-status/request-status.service';
import { CreateRequestToTravelDto } from './dto/createRequestToTravel.dto';
import { CreateRequestToDemandDto } from './dto/createRequestToDemand.dto';
import { TravelService } from 'src/travel/travel.service';
import { DemandService } from 'src/demand/demand.service';
import { TransactionService } from 'src/transaction/transaction.service';
import { FindRequestsQueryDto } from './dto/findRequestsQuery.dto';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { RequestResponseDto, PaginatedRequestsResponseDto, UserResponseDto, StatusResponseDto } from './dto/request-response.dto';
import { UserEventsService } from 'src/events/user-events.service';
import { RequestStatusHistoryEntity } from 'src/request-status-history/RequestStatusHistory.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { UserService } from 'src/user/user.service';
import { RequestMapper } from './request.mapper';
import { RequestStatusEntity } from 'src/request-status/requestStatus.entity';
import { CustomBadRequestException, CustomForbiddenException, CustomNotFoundException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { AirlineService } from 'src/airline/airline.service';
import { AirportService } from 'src/airport/airport.service';
import { CommonService } from 'src/common/service/common.service';
import { PlatformPricingService } from 'src/platform-pricing/platform-pricing.service';
import { StripeService } from 'src/stripe/stripe.service';
import { MessageService } from 'src/message/message.service';
import { ReviewEntity } from 'src/review/review.entity';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'src/email/email.service';
import { RequestEvent } from 'src/events/user-events.service';
import { UserEventType } from 'src/events/event-types';
import { DeliveryProofService } from 'src/delivery-proof/delivery-proof.service';
import { getRequestTravelDateOnly, toDateOnly } from './utils/request-date-policy';
import { SettleRequestDto, SettleRequestAction } from './dto/settle-request.dto';

@Injectable()
export class RequestService {
  private readonly logger = new Logger(RequestService.name);
  private requestListCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(RequestEntity) private requestRepository: Repository<RequestEntity>,
    @InjectRepository(ReviewEntity) private reviewRepository: Repository<ReviewEntity>,
    @InjectRepository(UserEntity) private userRepository: Repository<UserEntity>,
    private requestStatusHistoryService: RequestStatusHistoryService,
    private requestStatusService: RequestStatusService,
    private travelService: TravelService,
    private demandService: DemandService,
    private transactionService: TransactionService,
    private readonly userEventService: UserEventsService,
    private readonly userService: UserService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly requestMapper: RequestMapper,
    private readonly airlineService: AirlineService,
    private readonly airportService: AirportService,
    private readonly commonService: CommonService,
    private readonly platformPricingService: PlatformPricingService,
    private readonly stripeService: StripeService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly deliveryProofService: DeliveryProofService,
  ) { }

  private canBypassTravelDateRules(): boolean {
    return this.configService.get<string>('CAN_COMPLETE_TRAVEL_BEFORE_TRAVEL_DATE') === 'true';
  }

  private assertTravelDateAllowsCompletion(request: RequestEntity): void {
    if (this.canBypassTravelDateRules()) {
      return;
    }
    const travelDate = getRequestTravelDateOnly(request);
    if (!travelDate) {
      return;
    }
    const currentDate = toDateOnly(new Date());
    if (currentDate < travelDate) {
      throw new CustomBadRequestException(
        `Cannot complete request before the travel date (${travelDate.toISOString().split('T')[0]}). The travel has not yet departed.`,
        ErrorCode.REQUEST_NOT_COMPLETED,
      );
    }
  }

  private async refundRequestTransaction(requestId: number): Promise<void> {
    const transaction = await this.transactionService.findTransactionByRequestId(requestId);
    if (!transaction) {
      return;
    }
    if (transaction.stripeTransferId) {
      this.logger.warn(
        `Refund skipped for request ${requestId}: funds already transferred (transfer ${transaction.stripeTransferId}).`,
      );
      return;
    }
    if (transaction.status === 'paid' && transaction.stripePaymentIntentId) {
      let travelerPaymentUSD: number;
      if (transaction.travelerPayment !== null && transaction.travelerPayment !== undefined) {
        travelerPaymentUSD = await this.stripeService.convertToUSD(
          transaction.travelerPayment,
          transaction.currencyCode || 'USD',
        );
      } else {
        throw new CustomBadRequestException(
          'Traveler payment amount not found in transaction',
          ErrorCode.INTERNAL_ERROR,
        );
      }
      await this.stripeService.refundPaymentIntentPartial(
        transaction.stripePaymentIntentId,
        travelerPaymentUSD,
      );
      await this.transactionService.updateTransactionStatus(transaction.id, 'refunded');
    }
  }

  private async releaseFundsForRequest(requestId: number, actingUser: UserEntity): Promise<void> {
    const transaction = await this.transactionService.getTransactionByRequestId(requestId);
    if (!transaction) {
      throw new CustomNotFoundException('Transaction not found', ErrorCode.TRANSACTION_NOT_FOUND);
    }

    const tryRelease = async () => {
      await this.transactionService.releaseFundsFromStripe(transaction.id, actingUser);
    };

    if (
      !transaction.stripeTransferId &&
      (transaction.status === 'paid' ||
        transaction.status === 'awaiting_transfer' ||
        transaction.status === 'awaiting_available_funds')
    ) {
      try {
        await tryRelease();
      } catch (error: any) {
        const msg = error?.message ?? '';
        if (
          msg.includes('transfers enabled') ||
          msg.includes('onboarding') ||
          msg.includes('capability') ||
          msg.includes('stripe_balance.stripe_transfers') ||
          msg.includes('stripe_transfers feature') ||
          msg.includes('bank account') ||
          msg.includes('debit card') ||
          msg.includes('external account') ||
          msg.includes('payout method')
        ) {
          await this.transactionService.updateTransactionStatus(transaction.id, 'awaiting_transfer');
        } else if (
          msg.includes('insufficient') ||
          msg.includes('available balance') ||
          msg.includes('available funds')
        ) {
          await this.transactionService.updateTransactionStatus(transaction.id, 'awaiting_available_funds');
        } else {
          throw new CustomBadRequestException(
            `Failed to release funds: ${msg}. Request status remains ACCEPTED.`,
            ErrorCode.INTERNAL_ERROR,
          );
        }
      }
    } else if (transaction.stripeTransferId) {
      this.logger.log(
        `Transaction ${transaction.id} already has transfer ${transaction.stripeTransferId}, skipping fund release`,
      );
    } else if (transaction.status !== 'paid' && transaction.status !== 'awaiting_transfer') {
      if (transaction.stripePaymentIntentId) {
        const paymentIntent = await this.stripeService.getPaymentIntent(transaction.stripePaymentIntentId);
        if (paymentIntent.status === 'succeeded') {
          await this.transactionService.updateTransactionStatus(transaction.id, 'paid');
          try {
            await tryRelease();
          } catch (error: any) {
            const msg = error?.message ?? '';
            if (msg.includes('transfers enabled') || msg.includes('onboarding') || msg.includes('capability')) {
              await this.transactionService.updateTransactionStatus(transaction.id, 'awaiting_transfer');
            } else if (
              msg.includes('insufficient') ||
              msg.includes('available balance') ||
              msg.includes('available funds')
            ) {
              await this.transactionService.updateTransactionStatus(transaction.id, 'awaiting_available_funds');
            } else {
              throw new CustomBadRequestException(
                `Failed to release funds: ${msg}. Request status remains ACCEPTED.`,
                ErrorCode.INTERNAL_ERROR,
              );
            }
          }
        } else {
          throw new CustomBadRequestException(
            `Transaction payment is not yet successful (Payment Intent status: ${paymentIntent.status}). Cannot release funds.`,
            ErrorCode.INTERNAL_ERROR,
          );
        }
      } else {
        throw new CustomBadRequestException(
          `Transaction payment is not yet successful (status: ${transaction.status}). Cannot release funds.`,
          ErrorCode.INTERNAL_ERROR,
        );
      }
    }
  }

  private async markRequestCompleted(
    requestId: number,
    request: RequestEntity,
    completingUser: UserEntity,
    options: { autoComplete?: boolean } = {},
  ): Promise<RequestEntity> {
    const completedStatus = await this.requestStatusService.getRequestByStatus('COMPLETED');
    if (!completedStatus) {
      throw new NotFoundException('Completed status not found');
    }

    request.currentStatusId = completedStatus.id;
    request.currentStatus = completedStatus;
    await this.requestRepository.save(request);
    await this.requestStatusHistoryService.record(requestId, completedStatus.id);

    const affectedUserIds = [request.requesterId];
    if (request.travel) {
      affectedUserIds.push(request.travel.userId);
    } else if (request.demand) {
      affectedUserIds.push(request.demand.userId);
    }
    await this.clearRequestListCacheForUsers(affectedUserIds);

    const updatedRequest = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['transactions', 'demand', 'travel', 'demand.user', 'travel.user', 'currentStatus', 'requester', 'deliveryProof'],
    });

    if (!updatedRequest) {
      throw new CustomNotFoundException('Updated Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }

    const ownerId = updatedRequest.travelId
      ? updatedRequest.travel?.userId
      : updatedRequest.demandId
        ? updatedRequest.demand?.userId
        : null;

    const updatedTransaction = await this.transactionService.getTransactionByRequestId(requestId);
    let fundStatus: 'pending_funds' | 'pending_onboarding' | 'released' | undefined;
    if (updatedTransaction) {
      if (updatedTransaction.stripeTransferId) {
        fundStatus = 'released';
      } else if (updatedTransaction.status === 'awaiting_available_funds') {
        fundStatus = 'pending_funds';
      } else if (updatedTransaction.status === 'awaiting_transfer') {
        fundStatus = 'pending_onboarding';
      }
    }

    if (options.autoComplete) {
      if (ownerId) {
        const owner = await this.userService.findOne({ id: ownerId });
        const requester = await this.userService.findOne({ id: request.requesterId });
        if (requester && owner) {
          this.userEventService.emitRequestAutoCompleted(requester, updatedRequest, false, ownerId);
          this.userEventService.emitRequestAutoCompleted(owner, updatedRequest, true, ownerId);
        }
      }
    } else {
      this.userEventService.emitRequestCompleted(completingUser, updatedRequest, false);
      if (ownerId) {
        const owner = await this.userService.findOne({ id: ownerId });
        if (owner) {
          await this.userEventService.emitRequestCompletedForOwner(owner, updatedRequest, true, fundStatus);
        }
      }
    }

    return updatedRequest;
  }

  async releaseFundsAndMarkCompleted(
    requestId: number,
    actingUser: UserEntity,
    options: { autoComplete?: boolean } = {},
  ): Promise<RequestEntity> {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }
    await this.releaseFundsForRequest(requestId, actingUser);
    return this.markRequestCompleted(requestId, request, actingUser, options);
  }

  private async markProofDeadlineMissed(request: RequestEntity): Promise<RequestEntity> {
    const missedStatus = await this.requestStatusService.getRequestByStatus('PROOF_DEADLINE_MISSED');
    if (!missedStatus) {
      throw new CustomNotFoundException('PROOF_DEADLINE_MISSED status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    request.currentStatusId = missedStatus.id;
    request.currentStatus = missedStatus;
    await this.requestRepository.save(request);
    await this.requestStatusHistoryService.record(request.id, missedStatus.id);

    const affectedUserIds = [request.requesterId];
    if (request.travel) {
      affectedUserIds.push(request.travel.userId);
    } else if (request.demand) {
      affectedUserIds.push(request.demand.userId);
    }
    await this.clearRequestListCacheForUsers(affectedUserIds);

    this.userEventService['eventEmitter'].emit(UserEventType.PROOF_DEADLINE_MISSED, {
      requestId: request.id,
      requesterId: request.requesterId,
      timestamp: new Date(),
    });

    return request;
  }

  //createRequest to seek travel - Updated to only require weight
  async createRequestToTravel(createRequestDto: CreateRequestToTravelDto, user: UserEntity): Promise<RequestEntity> {
    //check if user account is verified
    if (!user.isVerified) {
      throw new CustomBadRequestException('Your account is not verified', ErrorCode.USER_NOT_VERIFIED);
    }

    //check if travel is created by the same user as the requester
    if (createRequestDto.travelId && createRequestDto.travelId === user.id) {
      throw new CustomBadRequestException('You cannot create a request to your own travel', ErrorCode.REQUEST_OWN_TRAVEL);
    }

    // Get the travel to check if it's instant and validate weight availability
    const travel = await this.travelService.findOne({
      where: { id: createRequestDto.travelId },
      relations: ['user']
    });

    if (!travel) {
      throw new CustomNotFoundException('Travel not found', ErrorCode.TRAVEL_NOT_FOUND);
    }

    // Check if travel is still active
    if (travel.status !== 'active') {
      throw new CustomBadRequestException('Travel is no longer available', ErrorCode.TRAVEL_NOT_ACTIVE);
    }

    // Check if travel date has already passed (prefer travelDate, fallback to departureDatetime)
    const travelDt = (travel as any).travelDate ?? travel.departureDatetime;
    if (travelDt) {
      const travelDate = new Date(travelDt);
      const now = new Date();

      // Compare dates only (ignore time)
      const travelDateOnly = new Date(travelDate.getFullYear(), travelDate.getMonth(), travelDate.getDate());
      const currentDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (currentDateOnly > travelDateOnly) {
        throw new CustomBadRequestException(
          `Cannot create request for a travel that has already departed. Travel date: ${travelDateOnly}`,
          ErrorCode.TRAVEL_DATE_PASSED
        );
      }
    }

    // Check if there's enough weight available
    if (travel.weightAvailable < createRequestDto.weight) {
      throw new CustomBadRequestException(`Insufficient weight available. Only ${travel.weightAvailable}kg available, but ${createRequestDto.weight}kg requested.`, ErrorCode.INSUFFICIENT_WEIGHT_AVAILABLE);
    }

    // New validation: Check isSharedWeight requirements
    if (!travel.isSharedWeight) {
      // If not shared weight, request must be for the full totalWeightAllowance
      // Use Math.abs to handle floating-point precision issues
      if (Math.abs(createRequestDto.weight - travel.totalWeightAllowance) > 0.01) {
        throw new CustomBadRequestException(`This travel requires a request for the full weight allowance (${travel.totalWeightAllowance}kg). Partial requests are not allowed.`, ErrorCode.REQUEST_PARTIAL_REQUEST_NOT_ALLOWED);
      }
    }

    if (travel.isInstant && Number(travel.pricePerKg || 0) > 0 && !createRequestDto.paymentMethodId) {
      throw new CustomBadRequestException(
        'Payment method is required for instant travel requests.',
        ErrorCode.PAYMENT_PROCESSING_FAILED,
      );
    }

    // Use a transaction to ensure atomicity
    let validatedPaymentIntentId: string | undefined = undefined;
    try {
      return await this.requestRepository.manager.transaction(async (transactionalEntityManager) => {
        const request = transactionalEntityManager.create(RequestEntity, {
        travelId: createRequestDto.travelId,
        demandId: null,
        requestType: createRequestDto.requestType,
        weight: createRequestDto.weight,
        paymentMethodId: createRequestDto.paymentMethodId || null, // Store for non-instant travels
        createdBy: user.id,
        requesterId: user.id, // Add this field
        requester: user,
        isWeightReserved: false,
        weightReservedAt: null,
        weightReleasedAt: null,
      });

      // Determine initial status based on travel's isInstant setting
      let initialStatus: string;
      if (travel.isInstant) {
        initialStatus = 'ACCEPTED';
      } else {
        initialStatus = 'NEGOTIATING';
      }

      // FIX: Use transactional entity manager instead of service method to avoid connection issues
      const reqStatus = await transactionalEntityManager.findOne(
        RequestStatusEntity,
        { where: { status: initialStatus } }
      );

      if (!reqStatus) {
        throw new CustomNotFoundException(`No request status record found for ${initialStatus}`, ErrorCode.REQUEST_STATUS_NOT_FOUND);
      }

      request.currentStatusId = reqStatus.id;

      // If it's an instant travel, validate payment BEFORE creating request and reserving weight
      if (travel.isInstant && createRequestDto.paymentMethodId) {
        console.log('reached6 - validating payment for instant travel');
        
        // Load travel with currency relation for conversion
        const travelWithCurrency = await this.travelService.findOne({
          where: { id: travel.id },
          relations: ['currency', 'user']
        });

        // Calculate transaction amount for payment validation
        const travelerPayment = (createRequestDto.weight || 0) * travelWithCurrency!.pricePerKg;
        const pricing = await this.platformPricingService.calculateTotalAmount(travelerPayment);
        const transactionAmount = pricing.totalAmount;

        // Convert amount to USD for Stripe
        const currencyCode = travelWithCurrency!.currency?.code || 'USD';
        const convertedAmountUSD = await this.stripeService.convertToUSD(transactionAmount, currencyCode);
        const platformFeeUSD = await this.stripeService.convertToUSD(pricing.fee, currencyCode);

        // Validate and confirm payment synchronously BEFORE creating request
        // If payment fails, transaction will rollback and request won't be created
        const validatedPaymentIntent = await this.stripeService.validateAndConfirmPaymentIntent(
          convertedAmountUSD,
          createRequestDto.paymentMethodId,
          platformFeeUSD,
          {
            requestType: 'instant_travel',
            travelId: travel.id.toString(),
            requesterId: user.id.toString(),
            payeeId: travelWithCurrency!.userId.toString(),
          },
        );
        validatedPaymentIntentId = validatedPaymentIntent.id;
        console.log('reached7 - payment validated successfully, Payment Intent ID:', validatedPaymentIntentId);
      }

      const savedRequest = await transactionalEntityManager.save(RequestEntity, request);
      console.log('reached3', savedRequest);

      // Add status history record using the transactional entity manager
      const statusHistoryRecord = transactionalEntityManager.create(RequestStatusHistoryEntity, {
        requestId: savedRequest.id,
        requestStatusId: reqStatus!.id
      });
      await transactionalEntityManager.save(RequestStatusHistoryEntity, statusHistoryRecord);

      // Reserve kilos immediately for both non-instant (NEGOTIATING) and instant (ACCEPTED) requests.
      await this.reserveTravelWeightOrThrow(
        travel.id,
        createRequestDto.weight,
        transactionalEntityManager
      );
      savedRequest.isWeightReserved = true;
      savedRequest.weightReservedAt = new Date();
      savedRequest.weightReleasedAt = null;
      await transactionalEntityManager.save(RequestEntity, savedRequest);
      console.log('reached4 - after status history');

      // Clear cache for affected users (requester and travel owner)
      await this.clearRequestListCacheForUsers([
        user.id,        // Requester's cache
        travel.userId    // Travel owner's cache
      ]);
      console.log('reached5 - after cache clear');

      // If it's an instant travel, automatically process the acceptance
      if (travel.isInstant) {
        console.log('reached8 - processing instant travel');
        // Load the request with all necessary relations for instant processing
        const requestWithRelations = await transactionalEntityManager.findOne(RequestEntity, {
          where: { id: savedRequest.id },
          relations: ['travel', 'travel.user', 'travel.currency', 'demand', 'demand.user', 'demand.currency', 'requester']
        });
        console.log('reached9 - loaded relations');

        await this.processInstantTravelAcceptance(requestWithRelations!, travel, transactionalEntityManager, createRequestDto.paymentMethodId, validatedPaymentIntentId);
        console.log('reached10 - after instant processing');

        // Skip request created emails for instant travels - they'll get accepted emails instead
      } else {
        // Only emit request created events for non-instant travels
        // emit request created event (non-blocking)
        console.log('reached9 - emitting events');
        await this.userEventService.emitRequestCreated(user, savedRequest, false, travel.userId);

        //also send email to the user who published the travel (non-blocking)
        await this.userEventService.emitRequestCreated(travel.user!, savedRequest, true, travel.userId);
        console.log('reached10 - events emitted');
      }

        return savedRequest;
      });
    } catch (error) {
      // Stripe side effects happen before DB commit for instant requests.
      // If DB transaction fails after payment confirmation, refund to avoid orphaned charge.
      if (validatedPaymentIntentId) {
        try {
          await this.stripeService.refundPaymentIntent(validatedPaymentIntentId);
          this.logger.warn(`Compensation refund succeeded for PaymentIntent ${validatedPaymentIntentId}`);
        } catch (refundError) {
          this.logger.error(
            `Compensation refund failed for PaymentIntent ${validatedPaymentIntentId}: ${refundError instanceof Error ? refundError.message : refundError}`,
          );
        }
      }
      throw error;
    }
  }

  // New method to handle instant travel acceptance
  private async processInstantTravelAcceptance(
    request: RequestEntity,
    travel: any,
    transactionalEntityManager: any,
    paymentMethodId?: string,
    validatedPaymentIntentId?: string
  ): Promise<void> {
    try {
      console.log('processInstantTravelAcceptance - start');

      // Calculate transaction amount using Platform Pricing Service
      const travelerPayment = (request.weight || 0) * travel.pricePerKg;
      const pricing = await this.platformPricingService.calculateTotalAmount(travelerPayment);
      const transactionAmount = pricing.totalAmount;

      console.log('processInstantTravelAcceptance - before transaction creation');
      // Use transaction service to create transaction with Stripe integration
      // Note: We need to reload request with relations after save
      const requestWithRelations = await transactionalEntityManager.findOne(RequestEntity, {
        where: { id: request.id },
        relations: ['travel', 'travel.user', 'travel.currency', 'demand', 'demand.user', 'demand.currency']
      });

      // Create transaction using transaction service
      // If payment was already validated (validatedPaymentIntentId provided), use that Payment Intent ID
      // Otherwise, create new Payment Intent (for backward compatibility)
      await this.transactionService.createTransactionFromRequest(
        requestWithRelations!,
        transactionAmount,
        validatedPaymentIntentId ? undefined : paymentMethodId, // Don't create new Payment Intent if already validated
        transactionalEntityManager,
        validatedPaymentIntentId // Pass validated Payment Intent ID
      );
      console.log('processInstantTravelAcceptance - after transaction creation');

      // Emit request accepted event for instant travels (non-blocking)
      // Pass travel info so email templates can detect instant travel
      console.log('processInstantTravelAcceptance - before event emission');
      const requestWithTravel = { ...request, travel: travel, isInstant: true };
      // Travel owner should get isForOwner = true (owner email template)
      await this.userEventService.emitRequestAccepted(travel.user!, requestWithTravel, true, travel.userId);
      // Requester should get isForOwner = false (requester email template)
      await this.userEventService.emitRequestAccepted(request.requester!, requestWithTravel, false, travel.userId);
      console.log('processInstantTravelAcceptance - after event emission');

    } catch (error) {
      console.error('Error processing instant travel acceptance:', error);
      throw new CustomBadRequestException(`Failed to process instant travel acceptance: ${error.message}`, ErrorCode.INTERNAL_ERROR);
    }
  }


  async acceptRequest(requestId: number, user: UserEntity): Promise<any> {
    // 1. Find the request with all necessary relations including currentStatus and currency
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['demand', 'travel', 'demand.user', 'travel.user', 'travel.currency', 'demand.currency', 'currentStatus']
    });

    if (!request) {
      throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }

    // 2. Check if this is an instant travel request
    if (request.travel && request.travel.isInstant) {
      throw new CustomBadRequestException('This request is for an instant travel and has already been automatically accepted', ErrorCode.REQUEST_ALREADY_AUTOMATICALLY_ACCEPTED);
    }

    // 3. Get the "ACCEPTED" status to check against current status
    const acceptedStatus = await this.requestStatusService.getRequestByStatus('ACCEPTED');
    if (!acceptedStatus) {
      throw new CustomNotFoundException('Accepted status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    // 4. CHECK IF REQUEST IS ALREADY ACCEPTED
    if (request.currentStatusId === acceptedStatus.id) {
      throw new CustomBadRequestException(
        'Request has already been accepted',
        ErrorCode.REQUEST_ALREADY_ACCEPTED
      );
    }

    // 5. CHECK IF REQUEST IS IN A TERMINAL STATE (cannot be accepted)
    const terminalStatuses = ['COMPLETED', 'CANCELLED', 'DELIVERED'];
    if (request.currentStatus && terminalStatuses.includes(request.currentStatus.status)) {
      throw new CustomBadRequestException(
        `Cannot accept request with status '${request.currentStatus.status}'`,
        ErrorCode.REQUEST_CANNOT_BE_ACCEPTED
      );
    }

    // 6. Check if the user is authorized to accept this request
    // User must be the creator of either the demand or travel
    const isAuthorized =
      (request.demand && request.demand.user.id === user.id) ||
      (request.travel && request.travel.user.id === user.id);

    if (!isAuthorized) {
      throw new CustomForbiddenException('Only the creator of the demand or travel can accept requests', ErrorCode.REQUEST_UNAUTHORIZED);
    }

    const pricePerKg = request.travel?.pricePerKg ?? request.demand?.pricePerKg ?? 0;
    const requiresPayment = Number(pricePerKg) > 0;

    // 7. Require payment when travel/demand has a price: cancel and notify buyer if missing or if validation fails
    let validatedPaymentIntentId: string | undefined = undefined;
    if (requiresPayment && !request.paymentMethodId) {
      await this.cancelRequestDueToPaymentFailure(requestId, request, 'Payment method is required. Please create a new request with a valid payment method.');
      throw new CustomBadRequestException(
        'Payment method is required to accept this request.',
        ErrorCode.PAYMENT_PROCESSING_FAILED,
      );
    }
    if (request.paymentMethodId) {
      try {
        const travelerPayment = (request.weight || 0) * Number(pricePerKg);
        const pricing = await this.platformPricingService.calculateTotalAmount(travelerPayment);
        const transactionAmount = pricing.totalAmount;
        const currencyCode = request.travel?.currency?.code || request.demand?.currency?.code || 'USD';
        const convertedAmountUSD = await this.stripeService.convertToUSD(transactionAmount, currencyCode);
        const platformFeeUSD = await this.stripeService.convertToUSD(pricing.fee, currencyCode);
        const validatedPaymentIntent = await this.stripeService.validateAndConfirmPaymentIntent(
          convertedAmountUSD,
          request.paymentMethodId,
          platformFeeUSD,
          {
            requestType: 'non_instant_travel',
            requestId: request.id.toString(),
            requesterId: request.requesterId.toString(),
            payeeId: (request.travelId ? request.travel.user.id : request.demand.user.id).toString(),
          },
        );
        validatedPaymentIntentId = validatedPaymentIntent.id;
        console.log(`Payment validated successfully for request ${requestId}, Payment Intent ID: ${validatedPaymentIntentId}`);
      } catch (paymentErr: unknown) {
        const paymentErrorMessage = paymentErr instanceof Error ? paymentErr.message : 'Your payment could not be processed.';
        await this.cancelRequestDueToPaymentFailure(requestId, request, paymentErrorMessage);
        throw paymentErr;
      }
    }

    // 8–11. Update status, record history, and create transaction in a single DB transaction
    // so we never have ACCEPTED without a corresponding transaction
    const travelerPayment = (request.weight || 0) * Number(pricePerKg);
    const pricing = await this.platformPricingService.calculateTotalAmount(travelerPayment);
    const transactionAmount = pricing.totalAmount;

    try {
      await this.requestRepository.manager.transaction(async (transactionalEntityManager) => {
      // 8. Update request status to ACCEPTED
      request.currentStatusId = acceptedStatus.id;
      request.currentStatus = acceptedStatus;
      await transactionalEntityManager.save(RequestEntity, request);

      // 9. Add status history record (same transaction)
      await this.requestStatusHistoryService.record(requestId, acceptedStatus.id, transactionalEntityManager);

      // 10. Reload request with currency relations for Stripe conversion
      const requestWithCurrency = await transactionalEntityManager.findOne(RequestEntity, {
        where: { id: requestId },
        relations: ['travel', 'travel.user', 'travel.currency', 'demand', 'demand.user', 'demand.currency', 'currentStatus']
      });

      // 11. Create transaction (same transaction; rollback if this fails)
      await this.transactionService.createTransactionFromRequest(
        requestWithCurrency!,
        transactionAmount,
        validatedPaymentIntentId ? undefined : request.paymentMethodId || undefined,
        transactionalEntityManager,
        validatedPaymentIntentId
      );
      });
    } catch (error) {
      // If payment succeeded but DB transaction fails, compensate with full refund.
      if (validatedPaymentIntentId) {
        try {
          await this.stripeService.refundPaymentIntent(validatedPaymentIntentId);
          this.logger.warn(`Compensation refund succeeded for PaymentIntent ${validatedPaymentIntentId}`);
        } catch (refundError) {
          this.logger.error(
            `Compensation refund failed for PaymentIntent ${validatedPaymentIntentId}: ${refundError instanceof Error ? refundError.message : refundError}`,
          );
        }
      }
      throw error;
    }

    // 12. Handle business logic based on request type (after transaction succeeds)
    if (request.travelId) {
      await this.handleTravelRequestAcceptance(request);
    } else if (request.demandId) {
      await this.handleDemandRequestAcceptance(request);
    }

    // 13. Clear cache for affected users (requester and travel/demand owner)
    const affectedUserIds = [request.requesterId];
    if (request.travel) {
      affectedUserIds.push(request.travel.userId);
    } else if (request.demand) {
      affectedUserIds.push(request.demand.userId);
    }
    await this.clearRequestListCacheForUsers(affectedUserIds);

    // 13. emit request accepted event (send email to traveler who published the travel)
    await this.userEventService.emitRequestAccepted(user, request, true, request.travel.userId);

    //get the requester
    const requester = await this.userService.findOne({
      id: request.requesterId,
    });
    //send email to the requester
    await this.userEventService.emitRequestAccepted(requester!, request, false, request.travel.userId);

    // Reload request with all relations for mapping (include currentStatus)
    const updatedRequest = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['travel', 'travel.user', 'demand', 'currentStatus']
    });

    return this.requestMapper.toAcceptResponseDto(updatedRequest!);
  }

  /**
   * Complete a request
   * @param requestId - The ID of the request to complete
   * @param user - The user who is completing the request
   * @returns The completed request response dto
   * 
   */
  async completeRequest(requestId: number, user: UserEntity): Promise<RequestEntity> {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }
    const acceptedStatus = await this.requestStatusService.getRequestByStatus('ACCEPTED');
    if (!acceptedStatus) {
      throw new CustomNotFoundException('Accepted status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }
    if (request.currentStatusId !== acceptedStatus.id) {
      throw new CustomBadRequestException('Request is not in ACCEPTED status', ErrorCode.REQUEST_NOT_IN_ACCEPTED_STATUS);
    }
    if (request.requesterId !== user.id) {
      throw new CustomForbiddenException('Only the requester can complete this request', ErrorCode.REQUEST_UNAUTHORIZED);
    }

    this.assertTravelDateAllowsCompletion(request);

    const hasProof = await this.deliveryProofService.hasMeetingProof(requestId);
    if (!hasProof) {
      throw new CustomBadRequestException(
        'Meeting proof is required before completing this request',
        ErrorCode.MEETING_PROOF_REQUIRED,
      );
    }

    return this.releaseFundsAndMarkCompleted(requestId, user);
  }

  async settleProofDeadlineMissed(
    requestId: number,
    admin: UserEntity,
    dto: SettleRequestDto,
  ): Promise<RequestEntity> {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }

    const missedStatus = await this.requestStatusService.getRequestByStatus('PROOF_DEADLINE_MISSED');
    if (!missedStatus || request.currentStatusId !== missedStatus.id) {
      throw new CustomBadRequestException(
        'Request is not in PROOF_DEADLINE_MISSED status',
        ErrorCode.REQUEST_NOT_PROOF_DEADLINE_MISSED,
      );
    }

    if (request.settledAt) {
      throw new CustomBadRequestException('Request has already been settled by an admin', ErrorCode.REQUEST_NOT_FOUND);
    }

    const settleAction =
      dto.action === SettleRequestAction.CANCEL_AND_REFUND
        ? 'CANCEL_AND_REFUND'
        : 'COMPLETE_AND_RELEASE_FUNDS';

    request.settledAt = new Date();
    request.settledByUserId = admin.id;
    request.settleAction = settleAction;
    request.settleNote = dto.note ?? null;
    await this.requestRepository.save(request);

    let result: RequestEntity;

    if (dto.action === SettleRequestAction.CANCEL_AND_REFUND) {
      await this.refundRequestTransaction(requestId);

      const cancelledStatus = await this.requestStatusService.getRequestByStatus('CANCELLED');
      if (!cancelledStatus) {
        throw new CustomNotFoundException('CANCELLED status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
      }

      await this.requestRepository.manager.transaction(async (transactionalEntityManager) => {
        const lockedRequest = await transactionalEntityManager.findOne(RequestEntity, {
          where: { id: requestId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!lockedRequest) {
          throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
        }
        lockedRequest.currentStatusId = cancelledStatus.id;
        lockedRequest.currentStatus = cancelledStatus;
        lockedRequest.settledAt = request.settledAt;
        lockedRequest.settledByUserId = request.settledByUserId;
        lockedRequest.settleAction = request.settleAction;
        lockedRequest.settleNote = request.settleNote;
        await transactionalEntityManager.save(RequestEntity, lockedRequest);
        await this.requestStatusHistoryService.record(requestId, cancelledStatus.id, transactionalEntityManager);
        await this.releaseReservedTravelWeightIfNeeded(requestId, transactionalEntityManager);
      });

      result = (await this.getRequestById(requestId))!;
      const ownerId = result.travelId ? result.travel?.userId : result.demand?.userId;
      const requester = await this.userService.findOne({ id: result.requesterId });
      if (requester && ownerId) {
        this.userEventService.emitRequestCancelled(requester, result, false, ownerId);
      }
    } else if (dto.action === SettleRequestAction.COMPLETE_AND_RELEASE_FUNDS) {
      result = await this.releaseFundsAndMarkCompleted(requestId, admin);
      result.settledAt = request.settledAt;
      result.settledByUserId = request.settledByUserId;
      result.settleAction = request.settleAction;
      result.settleNote = request.settleNote;
      await this.requestRepository.save(result);
    } else {
      throw new CustomBadRequestException('Invalid settle action', ErrorCode.SETTLE_ACTION_INVALID);
    }

    this.userEventService['eventEmitter'].emit(UserEventType.REQUEST_SETTLED_BY_ADMIN, {
      requestId,
      adminId: admin.id,
      action: dto.action,
      timestamp: new Date(),
    });

    await this.clearRequestListCache();
    return (await this.getRequestById(requestId))!;
  }

  /**
   * Cancel a request due to payment failure (e.g. card declined or missing payment method).
   * Updates DB explicitly, records history, notifies buyer by email, and clears cache.
   */
  private async cancelRequestDueToPaymentFailure(
    requestId: number,
    request: RequestEntity,
    paymentErrorMessage: string,
  ): Promise<void> {
    this.logger.log(
      `[Payment-failure] cancelRequestDueToPaymentFailure called: requestId=${requestId}, requesterId=${request.requesterId}, errorLength=${paymentErrorMessage?.length ?? 0}`,
    );
    const cancelledStatus = await this.requestStatusService.getRequestByStatus('CANCELLED');
    if (!cancelledStatus) {
      throw new CustomNotFoundException('CANCELLED request status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }
    await this.requestRepository.manager.transaction(async (transactionalEntityManager) => {
      const lockedRequest = await transactionalEntityManager.findOne(RequestEntity, {
        where: { id: requestId },
        relations: ['travel', 'demand', 'currentStatus'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedRequest) {
        throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
      }

      lockedRequest.currentStatusId = cancelledStatus.id;
      lockedRequest.currentStatus = cancelledStatus;
      await transactionalEntityManager.save(RequestEntity, lockedRequest);
      await this.requestStatusHistoryService.record(requestId, cancelledStatus.id, transactionalEntityManager);
      await this.releaseReservedTravelWeightIfNeeded(requestId, transactionalEntityManager);

      request.currentStatusId = lockedRequest.currentStatusId;
      request.currentStatus = lockedRequest.currentStatus;
      request.isWeightReserved = lockedRequest.isWeightReserved;
      request.weightReleasedAt = lockedRequest.weightReleasedAt;
    });
    const ownerId = request.travel?.userId ?? request.demand?.userId ?? 0;

    this.logger.log(`[Payment-failure] Loading requester: id=${request.requesterId}`);
    const requester = await this.userService.findOne({ id: request.requesterId });
    if (!requester) {
      this.logger.warn(
        `cancelRequestDueToPaymentFailure: requester not found for requestId=${requestId}, requesterId=${request.requesterId}. Payment-failure email not sent.`,
      );
    } else {
      this.logger.log(`[Payment-failure] Requester found: userId=${requester.id}, email=${requester.email ?? '(null)'}`);
      request.requester = requester;
      const eventPayload: RequestEvent = {
        userId: requester.id,
        userFirstName: this.commonService.userGreetingName(requester),
        userEmail: requester.email,
        timestamp: new Date(),
        requesterId: request.requesterId,
        requesterName: this.commonService.userFullName(requester),
        ownerId,
        requestId: request.id,
        requestType: request.requestType,
        weight: request.weight,
        isForOwner: false,
      };
      this.logger.log(`Sending payment-failure email to requester: ${requester.email} (requestId=${requestId})`);
      try {
        const sent = await this.emailService.sendRequestCancelledDueToPaymentFailureConfirmation(
          requester.email,
          this.commonService.userGreetingName(requester),
          eventPayload,
          paymentErrorMessage,
        );
        if (!sent) {
          this.logger.warn(
            `Payment-failure email was not sent to ${requester.email} (requestId=${requestId}). Check EMAIL_* env or logs above.`,
          );
        } else {
          this.logger.log(`Payment-failure email sent to ${requester.email} (requestId=${requestId})`);
        }
      } catch (err) {
        this.logger.error(
          `Failed to send payment-failure email to ${requester.email} (requestId=${requestId}):`,
          err instanceof Error ? err.message : err,
        );
      }
      this.userEventService.emitRequestCancelled(requester, request, false, ownerId, paymentErrorMessage, true);
    }

    if (ownerId > 0) {
      this.logger.log(`[Payment-failure] Loading owner: id=${ownerId}`);
      const owner = await this.userService.findOne({ id: ownerId });
      if (!owner) {
        this.logger.warn(
          `cancelRequestDueToPaymentFailure: owner not found for requestId=${requestId}, ownerId=${ownerId}. Owner notification not sent.`,
        );
      } else {
        this.logger.log(`[Payment-failure] Notifying owner: userId=${owner.id}, email=${owner.email ?? '(null)'}`);
        this.userEventService.emitRequestCancelled(owner, request, true, ownerId, paymentErrorMessage);
      }
    }

    const affectedUserIds = [request.requesterId];
    if (request.travel) affectedUserIds.push(request.travel.userId);
    else if (request.demand) affectedUserIds.push(request.demand.userId);
    await this.clearRequestListCacheForUsers(affectedUserIds);
  }

  async cancelRequest(requestId: number, user: UserEntity): Promise<RequestEntity> {
    // 1. Get request with all necessary relations
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }

    // 2. Determine if this is a cancellation (requester) or rejection (travel/demand owner)
    const isRequester = request.requesterId === user.id;
    const isOwner = (request.travel && request.travel.userId === user.id) ||
      (request.demand && request.demand.userId === user.id);

    if (!isRequester && !isOwner) {
      throw new CustomForbiddenException(
        'Only the requester or travel/demand owner can cancel/reject this request',
        ErrorCode.REQUEST_UNAUTHORIZED
      );
    }

    // 3. Check if request is already COMPLETED
    const completedStatus = await this.requestStatusService.getRequestByStatus('COMPLETED');
    if (!completedStatus) {
      throw new CustomNotFoundException('Completed status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    if (request.currentStatusId === completedStatus.id) {
      throw new CustomBadRequestException('Cannot cancel/reject a completed request', ErrorCode.REQUEST_NOT_FOUND);
    }

    // 4. Check if request is already CANCELLED or REJECTED
    const cancelledStatus = await this.requestStatusService.getRequestByStatus('CANCELLED');
    const rejectedStatus = await this.requestStatusService.getRequestByStatus('REJECTED');

    if (!cancelledStatus) {
      throw new CustomNotFoundException('CANCELLED request status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    if (!rejectedStatus) {
      throw new CustomNotFoundException('REJECTED request status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    if (request.currentStatusId === cancelledStatus.id) {
      throw new CustomBadRequestException('Request is already cancelled', ErrorCode.REQUEST_NOT_FOUND);
    }

    if (request.currentStatusId === rejectedStatus.id) {
      throw new CustomBadRequestException('Request is already rejected', ErrorCode.REQUEST_NOT_FOUND);
    }

    // 4.5 Check if request is already in PENDING_CANCELLATION_CONFIRMATION
    const pendingCancellationStatus = await this.requestStatusService.getRequestByStatus('PENDING_CANCELLATION_CONFIRMATION');
    if (pendingCancellationStatus && request.currentStatusId === pendingCancellationStatus.id) {
      throw new CustomBadRequestException('Cancellation confirmation is already pending. Please wait for seller response.', ErrorCode.REQUEST_NOT_FOUND);
    }

    // 5. Handle cancellation (requester) - check travel date and process accordingly
    if (isRequester) {
      // Determine if cancellation is before or during/after travel date
      let isBeforeTravelDate = false;
      let travelDate: Date | null = null;

      const requestTravelDt = request.travel ? ((request.travel as any).travelDate ?? request.travel.departureDatetime) : null;
      if (request.travel && requestTravelDt) {
        const travelDatetime = new Date(requestTravelDt);
        travelDate = new Date(travelDatetime.getFullYear(), travelDatetime.getMonth(), travelDatetime.getDate());
        const currentDate = new Date();
        const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        isBeforeTravelDate = currentDateOnly < travelDate;
      } else if (request.demand && request.demand.travelDate) {
        const demandTravelDate = new Date(request.demand.travelDate);
        travelDate = new Date(demandTravelDate.getFullYear(), demandTravelDate.getMonth(), demandTravelDate.getDate());
        const currentDate = new Date();
        const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        isBeforeTravelDate = currentDateOnly < travelDate;
      }

      // If cancellation is BEFORE travel date: immediate cancellation with refund (if transaction exists)
      if (isBeforeTravelDate) {
        const transaction = await this.transactionService.getTransactionByRequestId(requestId);
        if (!transaction) {
          // Request accepted but no transaction (e.g. legacy/orphan). Allow cancellation without refund.
          this.logger.warn(
            `Cancelling request ${requestId} with no corresponding transaction (accepted-without-transaction case).`
          );
        } else {
          // Process refund (only travelerPayment, fee is kept)
          if (transaction.status === 'paid' && transaction.stripePaymentIntentId) {
            try {
              // Convert travelerPayment to USD (Payment Intent is in USD)
              let travelerPaymentUSD: number;
              if (transaction.travelerPayment !== null && transaction.travelerPayment !== undefined) {
                travelerPaymentUSD = await this.stripeService.convertToUSD(
                  transaction.travelerPayment,
                  transaction.currencyCode || 'USD'
                );
              } else {
                throw new CustomBadRequestException('Traveler payment amount not found in transaction', ErrorCode.INTERNAL_ERROR);
              }

              // Refund only the travelerPayment amount (partial refund)
              await this.stripeService.refundPaymentIntentPartial(
                transaction.stripePaymentIntentId,
                travelerPaymentUSD
              );

              // Update transaction status to refunded
              await this.transactionService.updateTransactionStatus(transaction.id, 'refunded');
            } catch (error) {
              console.error(`Failed to refund transaction ${transaction.id}: ${error.message}`);
              throw new CustomBadRequestException(
                `Failed to process refund: ${error.message}`,
                ErrorCode.INTERNAL_ERROR
              );
            }
          } else if (transaction.status === 'pending') {
            // For pending transactions, just mark as cancelled (no refund needed)
            await this.transactionService.updateTransactionStatus(transaction.id, 'cancelled');
          }
        }
      } else {
        // If cancellation is DURING/AFTER travel date: require seller confirmation
        // Set status to PENDING_CANCELLATION_CONFIRMATION
        if (!pendingCancellationStatus) {
          throw new CustomNotFoundException('PENDING_CANCELLATION_CONFIRMATION status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
        }

        request.currentStatusId = pendingCancellationStatus.id;
        request.currentStatus = pendingCancellationStatus;
        request.cancellationRequestedAt = new Date();
        await this.requestRepository.save(request);
        await this.requestStatusHistoryService.record(requestId, pendingCancellationStatus.id);

        // Send email and notification to seller requesting confirmation
        const ownerId = request.travelId ? request.travel.userId : (request.demandId ? request.demand.userId : null);
        if (ownerId) {
          const owner = await this.userService.findOne({ id: ownerId });
          if (owner) {
            // Emit event for cancellation confirmation request
            this.userEventService.emitCancellationConfirmationRequested(owner, request, ownerId);
          }
        }

        // Clear cache and return early (don't process refund or change status to CANCELLED yet)
        await this.clearRequestListCache();
        return request;
      }
    }
    // Note: For rejection (owner), no refund is processed

    // 7-8. Persist terminal status and release reserved kilos atomically.
    await this.requestRepository.manager.transaction(async (transactionalEntityManager) => {
      const lockedRequest = await transactionalEntityManager.findOne(RequestEntity, {
        where: { id: requestId },
        relations: ['travel', 'demand', 'currentStatus'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedRequest) {
        throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
      }

      if (isRequester) {
        lockedRequest.currentStatusId = cancelledStatus.id;
        lockedRequest.currentStatus = cancelledStatus;
        await transactionalEntityManager.save(RequestEntity, lockedRequest);
        await this.requestStatusHistoryService.record(requestId, cancelledStatus.id, transactionalEntityManager);
      } else {
        lockedRequest.currentStatusId = rejectedStatus.id;
        lockedRequest.currentStatus = rejectedStatus;
        await transactionalEntityManager.save(RequestEntity, lockedRequest);
        await this.requestStatusHistoryService.record(requestId, rejectedStatus.id, transactionalEntityManager);
      }

      await this.releaseReservedTravelWeightIfNeeded(requestId, transactionalEntityManager);
      request.currentStatusId = lockedRequest.currentStatusId;
      request.currentStatus = lockedRequest.currentStatus;
      request.isWeightReserved = lockedRequest.isWeightReserved;
      request.weightReleasedAt = lockedRequest.weightReleasedAt;
    });

    // 9. Send email and notification to requester (isForOwner=false)
    const requester = await this.userService.findOne({ id: request.requesterId });
    if (requester) {
      const ownerId = request.travelId ? request.travel.userId : (request.demandId ? request.demand.userId : null);
      if (ownerId) {
        if (isRequester) {
          this.userEventService.emitRequestCancelled(requester, request, false, ownerId);
        } else {
          this.userEventService.emitRequestRejected(requester, request, false, ownerId);
        }
      }
    }

    // 10. Send email and notification to travel/demand owner (isForOwner=true)
    if (request.travelId && request.travel) {
      const travelOwner = await this.userService.findOne({ id: request.travel.userId });
      if (travelOwner) {
        if (isRequester) {
          this.userEventService.emitRequestCancelled(travelOwner, request, true, request.travel.userId);
        } else {
          this.userEventService.emitRequestRejected(travelOwner, request, true, request.travel.userId);
        }
      }
    } else if (request.demandId && request.demand) {
      const demandOwner = await this.userService.findOne({ id: request.demand.userId });
      if (demandOwner) {
        if (isRequester) {
          this.userEventService.emitRequestCancelled(demandOwner, request, true, request.demand.userId);
        } else {
          this.userEventService.emitRequestRejected(demandOwner, request, true, request.demand.userId);
        }
      }
    }

    // 11. Clear cache
    await this.clearRequestListCache();

    return request;
  }

  /**
   * Shared outcome for seller confirm and timeout auto-cancel: refund (when applicable), CANCELLED, weight restore, buyer notification.
   */
  private async finalizePendingCancellationAsConfirmed(
    request: RequestEntity,
    confirmedByUserId: number | null,
  ): Promise<RequestEntity> {
    const requestId = request.id;
    const pendingCancellationStatus = await this.requestStatusService.getRequestByStatus('PENDING_CANCELLATION_CONFIRMATION');
    if (!pendingCancellationStatus) {
      throw new CustomNotFoundException('PENDING_CANCELLATION_CONFIRMATION status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    if (request.currentStatusId !== pendingCancellationStatus.id) {
      throw new CustomBadRequestException(
        'Request is not pending cancellation confirmation',
        ErrorCode.REQUEST_NOT_FOUND
      );
    }

    if (request.cancellationConfirmedAt || request.cancellationDisputedAt) {
      throw new CustomBadRequestException(
        'Cancellation has already been confirmed or disputed',
        ErrorCode.REQUEST_NOT_FOUND
      );
    }

    const cancelledStatus = await this.requestStatusService.getRequestByStatus('CANCELLED');
    if (!cancelledStatus) {
      throw new CustomNotFoundException('CANCELLED request status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    try {
      await this.refundRequestTransaction(requestId);
    } catch (error) {
      this.logger.error(
        `Failed to refund transaction for request ${requestId}: ${error instanceof Error ? error.message : error}`,
      );
      throw new CustomBadRequestException(
        `Failed to process refund: ${error instanceof Error ? error.message : error}`,
        ErrorCode.INTERNAL_ERROR,
      );
    }

    await this.requestRepository.manager.transaction(async (transactionalEntityManager) => {
      const lockedRequest = await transactionalEntityManager.findOne(RequestEntity, {
        where: { id: requestId },
        relations: ['travel', 'demand', 'currentStatus'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedRequest) {
        throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
      }

      lockedRequest.currentStatusId = cancelledStatus.id;
      lockedRequest.currentStatus = cancelledStatus;
      lockedRequest.cancellationConfirmedAt = new Date();
      lockedRequest.cancellationConfirmedBy = confirmedByUserId;
      await transactionalEntityManager.save(RequestEntity, lockedRequest);
      await this.requestStatusHistoryService.record(requestId, cancelledStatus.id, transactionalEntityManager);
      await this.releaseReservedTravelWeightIfNeeded(requestId, transactionalEntityManager);

      request.currentStatusId = lockedRequest.currentStatusId;
      request.currentStatus = lockedRequest.currentStatus;
      request.cancellationConfirmedAt = lockedRequest.cancellationConfirmedAt;
      request.cancellationConfirmedBy = lockedRequest.cancellationConfirmedBy;
      request.isWeightReserved = lockedRequest.isWeightReserved;
      request.weightReleasedAt = lockedRequest.weightReleasedAt;
    });

    const requester = await this.userService.findOne({ id: request.requesterId });
    const ownerId = request.travelId ? request.travel.userId : (request.demandId ? request.demand.userId : null);

    if (requester && ownerId) {
      this.userEventService.emitCancellationConfirmed(requester, request, ownerId);
    }

    await this.clearRequestListCache();

    return request;
  }

  /**
   * Seller confirms cancellation of a request cancelled during/after travel date
   */
  async confirmCancellationBySeller(requestId: number, user: UserEntity): Promise<RequestEntity> {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }

    const isOwner = (request.travel && request.travel.userId === user.id) ||
      (request.demand && request.demand.userId === user.id);

    if (!isOwner) {
      throw new CustomForbiddenException(
        'Only the travel/demand owner can confirm cancellation',
        ErrorCode.REQUEST_UNAUTHORIZED
      );
    }

    return this.finalizePendingCancellationAsConfirmed(request, user.id);
  }

  /**
   * Auto-confirm buyer cancellation when seller does not respond within CANCELLATION_CONFIRMATION_DAYS (scheduler).
   */
  async autoConfirmCancellationDueToNoResponse(requestId: number): Promise<RequestEntity> {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }
    return this.finalizePendingCancellationAsConfirmed(request, null);
  }

  /**
   * Seller disputes cancellation (claims service was fulfilled)
   */
  async disputeCancellationBySeller(requestId: number, user: UserEntity): Promise<RequestEntity> {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }

    // Validate seller is the travel/demand owner
    const isOwner = (request.travel && request.travel.userId === user.id) ||
      (request.demand && request.demand.userId === user.id);

    if (!isOwner) {
      throw new CustomForbiddenException(
        'Only the travel/demand owner can dispute cancellation',
        ErrorCode.REQUEST_UNAUTHORIZED
      );
    }

    // Validate request is in PENDING_CANCELLATION_CONFIRMATION status
    const pendingCancellationStatus = await this.requestStatusService.getRequestByStatus('PENDING_CANCELLATION_CONFIRMATION');
    if (!pendingCancellationStatus) {
      throw new CustomNotFoundException('PENDING_CANCELLATION_CONFIRMATION status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    if (request.currentStatusId !== pendingCancellationStatus.id) {
      throw new CustomBadRequestException(
        'Request is not pending cancellation confirmation',
        ErrorCode.REQUEST_NOT_FOUND
      );
    }

    // Check if already confirmed or disputed
    if (request.cancellationConfirmedAt || request.cancellationDisputedAt) {
      throw new CustomBadRequestException(
        'Cancellation has already been confirmed or disputed',
        ErrorCode.REQUEST_NOT_FOUND
      );
    }

    // Get CANCELLATION_DISPUTED status and update request
    const disputedStatus = await this.requestStatusService.getRequestByStatus('CANCELLATION_DISPUTED');
    if (!disputedStatus) {
      throw new CustomNotFoundException('CANCELLATION_DISPUTED status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    request.cancellationDisputedAt = new Date();
    request.cancellationConfirmedBy = user.id;
    request.currentStatusId = disputedStatus.id;
    request.currentStatus = disputedStatus;
    await this.requestRepository.save(request);
    await this.requestStatusHistoryService.record(requestId, disputedStatus.id);

    // Send email to buyer and admin (single CANCELLATION_DISPUTED emit to avoid duplicate admin email)
    const ownerId = request.travelId ? request.travel.userId : (request.demandId ? request.demand.userId : null);
    const requester = await this.userService.findOne({ id: request.requesterId });
    if (requester && ownerId) {
      // Emit event for buyer notification
      // `user` comes from JWT payload and may not contain firstName/lastName.
      // Use the seller loaded via request.travel.user / request.demand.user instead.
      const sellerUser = request.travel?.user ?? request.demand?.user;
      const sellerName = this.commonService.userFullName(sellerUser) || 'Unknown';
      const buyerEvent: RequestEvent = {
        userId: requester.id,
        userFirstName: this.commonService.userGreetingName(requester),
        userEmail: requester.email,
        timestamp: new Date(),
        requesterId: request.requesterId,
        requesterName: this.commonService.userFullName(requester),
        ownerId: ownerId,
        ownerName: sellerName,
        requestId: request.id,
        requestType: request.requestType,
        weight: request.weight,
        isForOwner: false,
      };
      this.userEventService['eventEmitter'].emit(UserEventType.CANCELLATION_DISPUTED, buyerEvent);
    }

    // Clear cache
    await this.clearRequestListCache();

    return request;
  }

  /**
   * Auto-complete requests that haven't been completed after specified days past travel date
   */
  async autoCompleteRequests(): Promise<{ completed: number; proofDeadlineMissed: number; errors: number }> {
    const autoCompleteDays = this.configService.get<number>('AUTO_COMPLETE_DAYS_AFTER_TRAVEL_DATE', 7);
    const acceptedStatus = await this.requestStatusService.getRequestByStatus('ACCEPTED');
    if (!acceptedStatus) {
      this.logger.error('ACCEPTED status not found');
      return { completed: 0, proofDeadlineMissed: 0, errors: 0 };
    }

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - autoCompleteDays);

    const requestsPastDeadline = await this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.travel', 'travel')
      .leftJoinAndSelect('request.demand', 'demand')
      .leftJoinAndSelect('request.requester', 'requester')
      .leftJoinAndSelect('request.deliveryProof', 'deliveryProof')
      .where('request.currentStatusId = :acceptedStatusId', { acceptedStatusId: acceptedStatus.id })
      .andWhere(
        '(COALESCE(travel.travelDate, travel.departureDatetime) IS NOT NULL AND DATE(COALESCE(travel.travelDate, travel.departureDatetime)) <= DATE(:cutoffDate)) OR ' +
        '(demand.travelDate IS NOT NULL AND DATE(demand.travelDate) <= DATE(:cutoffDate))',
        { cutoffDate: cutoffDate.toISOString().split('T')[0] },
      )
      .getMany();

    let completed = 0;
    let proofDeadlineMissed = 0;
    let errors = 0;

    for (const request of requestsPastDeadline) {
      try {
        const requester = await this.userService.findOne({ id: request.requesterId });
        if (!requester) {
          this.logger.warn(`Requester not found for request ${request.id}`);
          errors++;
          continue;
        }

        const hasProof =
          !!request.deliveryProof || (await this.deliveryProofService.hasMeetingProof(request.id));

        if (hasProof) {
          await this.releaseFundsAndMarkCompleted(request.id, requester, { autoComplete: true });
          completed++;
        } else {
          await this.markProofDeadlineMissed(request);
          proofDeadlineMissed++;
        }
      } catch (error) {
        this.logger.error(
          `Failed post-deadline processing for request ${request.id}: ${error instanceof Error ? error.message : error}`,
        );
        errors++;
      }
    }

    this.logger.log(
      `Post-deadline processing: ${completed} auto-completed, ${proofDeadlineMissed} proof deadline missed, ${errors} errors`,
    );
    return { completed, proofDeadlineMissed, errors };
  }

  private async reserveTravelWeightOrThrow(
    travelId: number,
    weightToReserve: number,
    transactionalEntityManager: EntityManager,
  ): Promise<void> {
    const travel = await transactionalEntityManager.findOne(TravelEntity, {
      where: { id: travelId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!travel) {
      throw new CustomNotFoundException('Travel not found', ErrorCode.TRAVEL_NOT_FOUND);
    }

    const travelWeightAvailable = Number(travel.weightAvailable) || 0;
    const requestWeight = Number(weightToReserve) || 0;
    const newAvailableWeight = travelWeightAvailable - requestWeight;

    if (newAvailableWeight < 0) {
      throw new CustomBadRequestException(
        `Insufficient weight available. Only ${travelWeightAvailable}kg available, but ${requestWeight}kg requested.`,
        ErrorCode.INSUFFICIENT_WEIGHT_AVAILABLE,
      );
    }

    travel.weightAvailable = newAvailableWeight;
    travel.status = Math.abs(newAvailableWeight) < 0.01 ? 'filled' : 'active';
    await transactionalEntityManager.save(TravelEntity, travel);
  }

  private async releaseReservedTravelWeightIfNeeded(
    requestId: number,
    transactionalEntityManager: EntityManager,
  ): Promise<void> {
    const request = await transactionalEntityManager.findOne(RequestEntity, {
      where: { id: requestId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!request || !request.travelId) {
      return;
    }

    if (!request.isWeightReserved || !!request.weightReleasedAt) {
      return;
    }

    const travel = await transactionalEntityManager.findOne(TravelEntity, {
      where: { id: request.travelId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!travel) {
      throw new CustomNotFoundException('Travel not found', ErrorCode.TRAVEL_NOT_FOUND);
    }

    const travelWeightAvailable = Number(travel.weightAvailable) || 0;
    const requestWeight = Number(request.weight) || 0;
    const totalWeightAllowance = Number(travel.totalWeightAllowance) || 0;
    const nextAvailableWeight = Math.min(
      totalWeightAllowance,
      travelWeightAvailable + requestWeight,
    );

    travel.weightAvailable = nextAvailableWeight;
    if (nextAvailableWeight > 0 && travel.status === 'filled') {
      travel.status = 'active';
    }
    await transactionalEntityManager.save(TravelEntity, travel);

    request.weightReleasedAt = new Date();
    request.isWeightReserved = false;
    await transactionalEntityManager.save(RequestEntity, request);
  }

  async reconcileTravelWeightAvailability(travelId: number): Promise<TravelEntity> {
    return this.requestRepository.manager.transaction(async (transactionalEntityManager) => {
      const travel = await transactionalEntityManager.findOne(TravelEntity, {
        where: { id: travelId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!travel) {
        throw new CustomNotFoundException('Travel not found', ErrorCode.TRAVEL_NOT_FOUND);
      }

      const holdingStatuses = ['NEGOTIATING', 'ACCEPTED', 'PENDING_CANCELLATION_CONFIRMATION', 'PROOF_DEADLINE_MISSED'];
      const reserved = await transactionalEntityManager
        .createQueryBuilder(RequestEntity, 'request')
        .leftJoin('request.currentStatus', 'currentStatus')
        .select('COALESCE(SUM(request.weight), 0)', 'sum')
        .where('request.travelId = :travelId', { travelId })
        .andWhere('request.isWeightReserved = :isWeightReserved', { isWeightReserved: true })
        .andWhere('request.weightReleasedAt IS NULL')
        .andWhere('currentStatus.status IN (:...statuses)', { statuses: holdingStatuses })
        .getRawOne<{ sum: string }>();

      const reservedWeight = Number(reserved?.sum || 0);
      const allowance = Number(travel.totalWeightAllowance) || 0;
      const reconciledAvailable = Math.max(0, Math.min(allowance, allowance - reservedWeight));

      travel.weightAvailable = reconciledAvailable;
      travel.status = Math.abs(reconciledAvailable) < 0.01 ? 'filled' : travel.status === 'cancelled' ? 'cancelled' : 'active';

      return await transactionalEntityManager.save(TravelEntity, travel);
    });
  }

  async reconcileAllTravelWeightAvailability(): Promise<{ updated: number; errors: number }> {
    const travelIds = await this.requestRepository
      .createQueryBuilder('request')
      .select('DISTINCT request.travelId', 'travelId')
      .where('request.travelId IS NOT NULL')
      .getRawMany<{ travelId: string }>();

    let updated = 0;
    let errors = 0;

    for (const row of travelIds) {
      const travelId = Number(row.travelId);
      if (!travelId) {
        continue;
      }

      try {
        await this.reconcileTravelWeightAvailability(travelId);
        updated++;
      } catch (error) {
        this.logger.error(`Failed to reconcile travel ${travelId}: ${error instanceof Error ? error.message : error}`);
        errors++;
      }
    }

    return { updated, errors };
  }

  // Helper method for travel requests
  private async handleTravelRequestAcceptance(_request: RequestEntity): Promise<void> {
    // Weight reservation is now done at request creation time.
    // Keep this method as a no-op for backward compatibility with existing call sites.
    return;
  }

  // Helper method for demand requests
  private async handleDemandRequestAcceptance(request: RequestEntity): Promise<void> {
    const demand = await this.demandService.findOne({
      where: { id: request.demandId! }
    });

    if (!demand) {
      throw new CustomNotFoundException('Demand not found', ErrorCode.DEMAND_NOT_FOUND);
    }

    // Update demand status to resolved
    demand.status = 'resolved';
    await this.demandService.save(demand);
  }

  async getAllRequests(query: FindRequestsQueryDto, user: UserEntity): Promise<PaginatedRequestsResponseDto> {
    // Generate cache key
    const cacheKey = this.generateRequestListCacheKey(query, user.id);
    this.requestListCacheKeys.add(cacheKey);

    // Check cache first
    const cachedData = await this.cacheManager.get<PaginatedRequestsResponseDto>(cacheKey);
    if (cachedData) {
      console.log(`Cache Hit---------> Returning requests list from Cache ${cacheKey}`);
      return cachedData;
    }

    console.log(`Cache Miss---------> Returning requests list from database`);

    const {
      page = 1,
      limit = 10,
      id,
      requesterId,
      travelId,
      demandId,
      requestType,
      packageDescription,
      limitDate,
      status,
      orderBy = 'createdAt:desc',
      minWeight,
      maxWeight,
      requesterEmail,
      travelerEmail
    } = query;

    const skip = (page - 1) * limit;

    // Build the query with complex logic for user permissions
    const queryBuilder = this.requestRepository.createQueryBuilder('request')
      .leftJoinAndSelect('request.requester', 'requester')
      .leftJoinAndSelect('request.travel', 'travel')
      .leftJoinAndSelect('travel.user', 'travelUser')
      .leftJoinAndSelect('travel.currency', 'travelCurrency')
      .leftJoinAndSelect('request.demand', 'demand')
      .leftJoinAndSelect('demand.currency', 'demandCurrency')
      .leftJoinAndSelect('request.currentStatus', 'currentStatus')
      .leftJoinAndSelect('request.deliveryProof', 'deliveryProof')
      .leftJoinAndSelect('request.requestStatusHistory', 'requestStatusHistory')
      .leftJoinAndSelect('requestStatusHistory.requestStatus', 'requestStatus') // Fixed: was 'requestStatuses'
      .skip(skip)
      .take(limit);

    // Apply user-specific filtering logic
    const isAdmin = user.role?.code === UserRole.ADMIN;
    const isOperator = user.role?.code === UserRole.OPERATOR;

    if (!isAdmin && !isOperator) {
      // Regular users can only see:
      // 1. Requests they created
      // 2. Requests linked to travels/demands they created
      queryBuilder.andWhere(
        '(request.requesterId = :userId OR travel.userId = :userId OR demand.userId = :userId)',
        { userId: user.id }
      );
    }

    // Apply filters
    if (id) {
      queryBuilder.andWhere('request.id = :id', { id });
    }

    if (requesterId && (isAdmin || isOperator)) {
      queryBuilder.andWhere('request.requesterId = :requesterId', { requesterId });
    }

    if (travelId) {
      queryBuilder.andWhere('request.travelId = :travelId', { travelId });
    }

    if (demandId) {
      queryBuilder.andWhere('request.demandId = :demandId', { demandId });
    }

    if (requestType) {
      queryBuilder.andWhere('request.requestType = :requestType', { requestType });
    }

    if (packageDescription) {
      queryBuilder.andWhere('LOWER(request.packageDescription) LIKE LOWER(:packageDescription)', {
        packageDescription: `%${packageDescription}%`
      });
    }

    if (minWeight !== undefined) {
      queryBuilder.andWhere('request.weight >= :minWeight', { minWeight });
    }

    if (maxWeight !== undefined) {
      queryBuilder.andWhere('request.weight <= :maxWeight', { maxWeight });
    }

    if (limitDate) {
      queryBuilder.andWhere('DATE(request.limitDate) = DATE(:limitDate)', { limitDate });
    }

    if (status) {
      const statusGroupMap: Record<'TO_CONFIRM' | 'AWAITING_DELIVER' | 'FINISHED' | 'PROOF_ISSUE', string[]> = {
        TO_CONFIRM: ['NEGOTIATING'],
        AWAITING_DELIVER: ['ACCEPTED', 'PENDING_CANCELLATION_CONFIRMATION'],
        PROOF_ISSUE: ['PROOF_DEADLINE_MISSED'],
        FINISHED: ['COMPLETED', 'CANCELLATION_DISPUTED', 'DELIVERED'],
      };

      const mappedStatuses = statusGroupMap[status as keyof typeof statusGroupMap];
      if (mappedStatuses?.length) {
        queryBuilder.andWhere('currentStatus.status IN (:...mappedStatuses)', { mappedStatuses });
      }
    }

    // Handle requesterEmail filter (admin/operator only) - look up user IDs and filter at DB level
    if (requesterEmail) {
      if (!isAdmin && !isOperator) {
        console.log('🔒 Ignoring requesterEmail filter - user is not admin or operator');
      } else {
        console.log('🔍 Debug - Admin/Operator filtering by requesterEmail:', requesterEmail);
        
        // Look up users with matching email (partial match)
        const matchingUsers = await this.userRepository.find({
          where: { email: Like(`%${requesterEmail}%`) },
          select: ['id', 'email']
        });
        
        const matchingUserIds = matchingUsers.map(u => u.id);
        console.log('🔍 Debug - Found users matching requesterEmail:', matchingUserIds.length, 'user IDs:', matchingUserIds);
        
        if (matchingUserIds.length > 0) {
          // Filter requests where the requester's email matches
          queryBuilder.andWhere('request.requesterId IN (:...requesterEmailUserIds)', { requesterEmailUserIds: matchingUserIds });
        } else {
          // No users match this email - force empty result by adding impossible condition
          queryBuilder.andWhere('1 = 0');
        }
      }
    }

    // Handle travelerEmail filter (admin/operator only) - look up user IDs and filter at DB level
    if (travelerEmail) {
      if (!isAdmin && !isOperator) {
        console.log('🔒 Ignoring travelerEmail filter - user is not admin or operator');
      } else {
        console.log('🔍 Debug - Admin/Operator filtering by travelerEmail:', travelerEmail);
        
        // Look up users with matching email (partial match)
        const matchingUsers = await this.userRepository.find({
          where: { email: Like(`%${travelerEmail}%`) },
          select: ['id', 'email']
        });
        
        const matchingUserIds = matchingUsers.map(u => u.id);
        console.log('🔍 Debug - Found users matching travelerEmail:', matchingUserIds.length, 'user IDs:', matchingUserIds);
        
        if (matchingUserIds.length > 0) {
          // Filter requests where the travel owner's email matches (request.travel.userId)
          queryBuilder.andWhere('travel.userId IN (:...travelerEmailUserIds)', { travelerEmailUserIds: matchingUserIds });
        } else {
          // No users match this email - force empty result by adding impossible condition
          queryBuilder.andWhere('1 = 0');
        }
      }
    }

    // Apply sorting
    const [sortField, sortDirection] = orderBy.split(':');
    const validSortFields = ['createdAt', 'limitDate', 'weight'];
    const validSortDirections = ['asc', 'desc'];

    if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      queryBuilder.orderBy(`request.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy('request.createdAt', 'DESC'); // default
    }

    // Get the count first
    const totalItems = await queryBuilder.getCount();

    // Get the actual data
    const items = await queryBuilder.getMany();

    // Batch fetch unread message counts for all requests
    const requestIds = items.map(item => item.id);
    const unreadCountsMap = await this.messageService.getUnreadCountsByRequestIds(requestIds, user.id);
    const latestMessageDatesMap = await this.messageService.getLatestMessageDatesByRequestIds(requestIds);

    // Transform the data to include only relevant fields (async transformation)
    const transformedItems = await Promise.all(
      items.map(request => {
        const unreadCount = unreadCountsMap.get(request.id) || 0;
        const lastMessageDateTime = latestMessageDatesMap.get(request.id) || null;
        return this.transformRequestToResponse(request, unreadCount, user, lastMessageDateTime);
      })
    );

    const totalPages = Math.ceil(totalItems / limit);

    const responseResult = {
      items: transformedItems,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages
      }
    };

    await this.cacheManager.set(cacheKey, responseResult, 5000); // Reduced TTL to 5 seconds for faster invalidation
    return responseResult;
  }

  // Add cache key generation method
  private generateRequestListCacheKey(query: FindRequestsQueryDto, userId: number): string {
    const {
      page = 1,
      limit = 10,
      id,
      requesterId,
      travelId,
      demandId,
      requestType,
      packageDescription,
      limitDate,
      status,
      orderBy = 'createdAt:desc',
      minWeight,
      maxWeight,
      requesterEmail,
      travelerEmail
    } = query;

    return `requests_list_user${userId}_page${page}_limit${limit}_id${id || 'all'}_requester${requesterId || 'all'}_travel${travelId || 'all'}_demand${demandId || 'all'}_type${requestType || 'all'}_desc${packageDescription || 'all'}_minWeight${minWeight || 'all'}_maxWeight${maxWeight || 'all'}_date${limitDate || 'all'}_status${status || 'all'}_order${orderBy}_requesterEmail${requesterEmail || 'all'}_travelerEmail${travelerEmail || 'all'}`;
  }

  // Enhanced cache clearing method with selective invalidation
  // Clears cache for specific affected users and tracked keys
  private async clearRequestListCacheForUsers(affectedUserIds: number[]): Promise<void> {
    const cacheKeysToDelete: string[] = [];

    // Common query combinations that users typically request
    // We clear these to ensure affected users see fresh data
    const commonQueryCombinations = [
      { page: 1, limit: 10 }, // Most common - first page with default limit
      { page: 1, limit: 20 },
      { page: 1, limit: 50 },
    ];

    // Generate cache keys for affected users with common queries
    for (const userId of affectedUserIds) {
      for (const query of commonQueryCombinations) {
        const cacheKey = this.generateRequestListCacheKey(query, userId);
        cacheKeysToDelete.push(cacheKey);
      }
    }

    // Also clear any tracked cache keys (from current instance)
    const trackedKeys = Array.from(this.requestListCacheKeys);
    cacheKeysToDelete.push(...trackedKeys);

    // Delete all cache keys in parallel for better performance
    if (cacheKeysToDelete.length > 0) {
      await Promise.all(
        cacheKeysToDelete.map(key => this.cacheManager.del(key))
      );
    }

    // Clear the tracked keys set
    this.requestListCacheKeys.clear();
  }

  // Legacy method for backward compatibility (can be removed if not used elsewhere)
  private async clearRequestListCache(): Promise<void> {
    // This method now delegates to the new selective clearing
    // If no specific users are known, we at least clear tracked keys
    const cacheKeys = Array.from(this.requestListCacheKeys);
    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }
    this.requestListCacheKeys.clear();
  }


  //createRequest to respond to demand
  /*async createRequestToDemand(createRequestDto: CreateRequestToDemandDto, user: UserEntity, image1: Express.Multer.File, image2: Express.Multer.File): Promise<RequestEntity> {
    //check if user account is verified
    if(!user.isVerified){
      throw new BadRequestException('Your account is not verified')
    }
    
    const request = this.requestRepository.create({
      demandId: createRequestDto.demandId,
      travelId: null,
      requestType: createRequestDto.requestType,
      weight: null,
      createdBy: user.id,
      requester: user
    })

    const reqStatus = await this.requestStatusService.getRequestByStatus('NEGOTIATING');
    request.currentStatusId = reqStatus!.id;
    
    const savedRequest = await this.requestRepository.save(request);

    try {
      // Upload both images with request association
      await this.fileUploadService.uploadMultipleFiles(
        [image1, image2],
        [FilePurpose.REQUEST_IMAGE_1, FilePurpose.REQUEST_IMAGE_2],
        user,
        undefined, // travel
        undefined, // demand
        savedRequest // request
      );

      // Clear cache
      await this.clearRequestListCache();

      //add a request status history record
      await this.requestStatusHistoryService.record(savedRequest.id, reqStatus!.id)
      return savedRequest;
    } catch (error) {
      // If image upload fails, delete the created request
      await this.requestRepository.remove(savedRequest);
      throw new BadRequestException(`Failed to upload images: ${error.message}`);
    }
  }*/

  //Get all Requests of a User
  async getRequestsByUser(userId: number): Promise<RequestEntity[]> {
    return this.requestRepository.find({
      where: { requester: { id: userId } },
      relations: ['demand', 'travel', 'requestStatusHistory', 'transactions', 'messages'],
      order: { createdAt: 'DESC' },
    });
  }

  //Get a Request by ID
  async getRequestById(id: number): Promise<RequestEntity | null> {
    return await this.requestRepository.findOne({
      where: { id },
      relations: [
        'demand',
        'travel',
        'demand.user',
        'travel.user',
        'requester',
        'currentStatus',
        'requestStatusHistory',
        'transactions',
        'messages',
        'deliveryProof',
      ],
    });
  }

  async findOne(arg: FindOptionsWhere<RequestEntity>): Promise<RequestEntity | null> {
    return await this.requestRepository.findOne({
      where: arg,
      relations: ['demand', 'travel', 'requestStatusHistory', 'transactions', 'messages'],
    });
  }
  async transformRequestToResponse(
    request: RequestEntity,
    unreadCount: number = 0,
    currentUser?: UserEntity,
    lastMessageDateTime?: Date | null,
  ): Promise<RequestResponseDto> {
    // Format requester fullName (prefer persisted username)
    const requesterFullName = request.requester
      ? this.commonService.userFullName(request.requester)
      : '';

    // Build requester object with fullName and profilePictureUrl
    const requester: UserResponseDto = request.requester ? {
      id: request.requester.id,
      fullName: requesterFullName,
      profilePictureUrl: request.requester.profilePictureUrl || null
    } : {
      id: request.requesterId,
      fullName: '',
      profilePictureUrl: null
    };

    // Build travel object with airline and airport information
    let travel: any = request.travel ? { ...request.travel } : null;

    if (travel) {
      if (travel.flightNumber) {
        // Get airline from flight number
        const airline = await this.airlineService.findByFlightNumber(travel.flightNumber);

        if (airline) {
          travel.airline = {
            airlineId: airline.id,
            name: airline.name,
            logoUrl: (airline.logoUrl as string | null) ?? null
          };
        } else {
          // If airline not found, set airline to null
          travel.airline = null;
        }
      }

      // Get departure and arrival airports
      if (travel.departureAirportId) {
        const departureAirport = await this.airportService.findOne(travel.departureAirportId);
        if (departureAirport) {
          travel.departureAirport = {
            name: departureAirport.name || '',
            municipality: departureAirport.municipality || '',
            isoCountry: departureAirport.isoCountry || '',
            iataCode: departureAirport.iataCode || ''
          };
        } else {
          travel.departureAirport = null;
        }
      } else {
        travel.departureAirport = null;
      }

      if (travel.arrivalAirportId) {
        const arrivalAirport = await this.airportService.findOne(travel.arrivalAirportId);
        if (arrivalAirport) {
          travel.arrivalAirport = {
            name: arrivalAirport.name || '',
            municipality: arrivalAirport.municipality || '',
            isoCountry: arrivalAirport.isoCountry || '',
            iataCode: arrivalAirport.iataCode || ''
          };
        } else {
          travel.arrivalAirport = null;
        }
      } else {
        travel.arrivalAirport = null;
      }

      // Add owner information using mapper
      if (request.travel?.user) {
        // Use mapper to transform user entity to UserResponseDto
        travel.owner = this.requestMapper.toUserResponseDto(request.travel.user);
      } else if (travel.userId) {
        // If user relation is not loaded but userId exists, fetch the user
        const travelOwner = await this.userService.findOne({ id: travel.userId });
        if (travelOwner) {
          travel.owner = this.requestMapper.toUserResponseDto(travelOwner);
        }
      }

      // Remove the user object from travel (we only want owner)
      if (travel.user) {
        delete travel.user;
      }

      // Remove the currency object from travel (we have it at top level)
      if (travel.currency) {
        delete travel.currency;
      }
    }

    let demand: any = request.demand ? { ...request.demand } : null;

    if (demand) {
      if (request.demand?.user) {
        demand.owner = this.requestMapper.toUserResponseDto(request.demand.user);
      } else if (demand.userId) {
        const demandOwner = await this.userService.findOne({ id: demand.userId });
        if (demandOwner) {
          demand.owner = this.requestMapper.toUserResponseDto(demandOwner);
        }
      }
      if (demand.user) {
        delete demand.user;
      }
      if (demand.currency) {
        delete demand.currency;
      }
    }

    // Extract currency from travel or demand
    let currency: { code: string; name: string; symbol: string } | null = null;
    if (request.travel?.currency) {
      currency = {
        code: request.travel.currency.code,
        name: request.travel.currency.name,
        symbol: request.travel.currency.symbol
      };
    } else if (request.demand?.currency) {
      currency = {
        code: request.demand.currency.code,
        name: request.demand.currency.name,
        symbol: request.demand.currency.symbol
      };
    }

    // Calculate canReview: true if request is COMPLETED and user hasn't reviewed it yet
    let canReview = false;
    if (currentUser && request.currentStatus?.status === 'COMPLETED') {
      // Check if user has already reviewed this request
      const existingReview = await this.reviewRepository.findOne({
        where: {
          requestId: request.id,
          reviewerId: currentUser.id
        }
      });
      // canReview is true only if no review exists
      canReview = !existingReview;
    }

    return {
      id: request.id,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      demandId: request.demandId,
      travelId: request.travelId,
      requesterId: request.requesterId,
      requestType: request.requestType,
      weight: request.weight,
      currentStatusId: request.currentStatusId,
      requester: requester,
      currentStatus: {
        status: request.currentStatus?.status
      } as StatusResponseDto,
      travel: travel,
      demand: demand,
      currency: currency,
      unReadMessages: unreadCount,
      lastMessageDateTime: lastMessageDateTime ?? null,
      canReview,
      hasMeetingProof: !!request.deliveryProof,
      meetingProofUploadedAt: request.deliveryProof?.uploadedAt ?? null,
      meetingProofUploadedByUserId: request.deliveryProof?.uploadedByUserId ?? null,
    };
  }

  /**
   * Helper method to get unread counts for requests
   * Wraps MessageService call to avoid circular dependency issues
   */
  async getUnreadCountsForRequests(requestIds: number[], userId: number): Promise<Map<number, number>> {
    return this.messageService.getUnreadCountsByRequestIds(requestIds, userId);
  }

  async getLatestMessageDatesForRequests(requestIds: number[]): Promise<Map<number, Date | null>> {
    return this.messageService.getLatestMessageDatesByRequestIds(requestIds);
  }
}
