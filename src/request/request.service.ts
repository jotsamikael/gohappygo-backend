import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestEntity } from './request.entity';
import { FindOptionsWhere, Repository } from 'typeorm';
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

@Injectable()
export class RequestService {
  private readonly logger = new Logger(RequestService.name);
  private requestListCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(RequestEntity) private requestRepository: Repository<RequestEntity>,
    @InjectRepository(ReviewEntity) private reviewRepository: Repository<ReviewEntity>,
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
    private readonly emailService: EmailService
  ) { }

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

    // Check if travel date has already passed
    if (travel.departureDatetime) {
      const travelDate = new Date(travel.departureDatetime);
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

    // Use a transaction to ensure atomicity
    return await this.requestRepository.manager.transaction(async (transactionalEntityManager) => {
      const request = transactionalEntityManager.create(RequestEntity, {
        travelId: createRequestDto.travelId,
        demandId: null,
        requestType: createRequestDto.requestType,
        weight: createRequestDto.weight,
        paymentMethodId: createRequestDto.paymentMethodId || null, // Store for non-instant travels
        createdBy: user.id,
        requesterId: user.id, // Add this field
        requester: user
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

      // If it's an instant travel, validate payment BEFORE creating request and deducting weight
      let validatedPaymentIntentId: string | undefined = undefined;
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
        this.userEventService.emitRequestCreated(user, savedRequest, false, travel.userId);

        //also send email to the user who published the travel (non-blocking)
        this.userEventService.emitRequestCreated(travel.user!, savedRequest, true, travel.userId);
        console.log('reached10 - events emitted');
      }

      return savedRequest;
    });
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

      // Update travel weight availability
      // Convert to numbers to handle decimal/string type issues from TypeORM
      const travelWeightAvailable = Number(travel.weightAvailable) || 0;
      const requestWeight = Number(request.weight) || 0;
      const newAvailableWeight = travelWeightAvailable - requestWeight;
      travel.weightAvailable = newAvailableWeight;

      // Check if travel is now filled (use small epsilon for floating point comparison)
      if (Math.abs(newAvailableWeight) < 0.01) {
        travel.status = 'filled';
      }

      console.log('processInstantTravelAcceptance - before travel save');
      // Use the transactional entity manager instead of the service
      await transactionalEntityManager.save('TravelEntity', travel);
      console.log('processInstantTravelAcceptance - after travel save');

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
      this.userEventService.emitRequestAccepted(travel.user!, requestWithTravel, true, travel.userId);
      // Requester should get isForOwner = false (requester email template)
      this.userEventService.emitRequestAccepted(request.requester!, requestWithTravel, false, travel.userId);
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
    this.userEventService.emitRequestAccepted(user, request, true, request.travel.userId);

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
    //0. check if request is in ACCEPTED status
    if (request.currentStatusId !== acceptedStatus.id) {
      throw new CustomBadRequestException('Request is not in ACCEPTED status', ErrorCode.REQUEST_NOT_IN_ACCEPTED_STATUS);
    }
    // 1. Check if the user is authorized to complete this request
    const isAuthorized = request.requesterId === user.id;
    if (!isAuthorized) {
      throw new CustomForbiddenException('Only the requester can complete this request', ErrorCode.REQUEST_UNAUTHORIZED);
    }

    // 1.5 Check if travel date has passed (unless CAN_COMPLETE_TRAVEL_BEFORE_TRAVEL_DATE is true)
    // Only compares dates, not times - allows completion on the same day regardless of time
    const canCompleteTravelBeforeTravelDate = this.configService.get<string>('CAN_COMPLETE_TRAVEL_BEFORE_TRAVEL_DATE') === 'true';
    console.log('canCompleteTravelBeforeTravelDate ->', canCompleteTravelBeforeTravelDate)
    //check if travel date has passed
    if (!canCompleteTravelBeforeTravelDate && request.travel) {
      const travelDatetime = new Date(request.travel.departureDatetime);
      const now = new Date();

      // Extract only the date portion (year, month, day) for comparison
      const travelDate = new Date(travelDatetime.getFullYear(), travelDatetime.getMonth(), travelDatetime.getDate());
      const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (currentDate < travelDate) {
        throw new CustomBadRequestException(
          `Cannot complete request before the travel date (${travelDate.toISOString().split('T')[0]}). The travel has not yet departed.`,
          ErrorCode.REQUEST_NOT_COMPLETED
        );
      }
    }

    // 2. Get transaction and attempt fund release FIRST (before changing status)
    // This ensures that if transfer fails, the request status remains ACCEPTED
    const transaction = await this.transactionService.getTransactionByRequestId(requestId);
    if (!transaction) {
      throw new CustomNotFoundException('Transaction not found', ErrorCode.TRANSACTION_NOT_FOUND);
    }

    // 3. Release funds from stripe to payee (only if transfer hasn't been created yet)
    // Do this BEFORE changing status so that if it fails, status remains ACCEPTED
    // Check if transfer hasn't been created (stripeTransferId is null) AND payment is successful (status is 'paid', 'awaiting_transfer', or 'awaiting_available_funds')
    if (!transaction.stripeTransferId && (transaction.status === 'paid' || transaction.status === 'awaiting_transfer' || transaction.status === 'awaiting_available_funds')) {
      try {
        await this.transactionService.releaseFundsFromStripe(transaction.id, user);
        // If transfer succeeds, status will be updated to 'paid' by releaseFundsFromStripe
      } catch (error) {
        // If transfer fails due to onboarding or missing external account, mark as awaiting_transfer and allow completion
        if (error.message.includes('transfers enabled') ||
          error.message.includes('onboarding') ||
          error.message.includes('capability') ||
          error.message.includes('stripe_balance.stripe_transfers') ||
          error.message.includes('stripe_transfers feature') ||
          error.message.includes('bank account') ||
          error.message.includes('debit card') ||
          error.message.includes('external account') ||
          error.message.includes('payout method')) {
          // Mark transaction as awaiting_transfer - funds will be released when payee completes onboarding/adds payout method
          await this.transactionService.updateTransactionStatus(transaction.id, 'awaiting_transfer');
          console.log(`Transaction ${transaction.id} marked as awaiting_transfer. Funds will be released when payee completes onboarding and adds a payout method.`);
          // Allow request completion - funds are safely held by platform
        } else if (error.message.includes('insufficient') ||
          error.message.includes('available balance') ||
          error.message.includes('available funds')) {
          // Insufficient balance handling - mark as awaiting_available_funds and allow completion
          await this.transactionService.updateTransactionStatus(transaction.id, 'awaiting_available_funds');
          console.log(`Transaction ${transaction.id} marked as awaiting_available_funds. Funds will be released when platform balance becomes available.`);
          // Allow request completion - funds will be released when available
        } else {
          // For other errors, don't allow completion
          throw new CustomBadRequestException(
            `Failed to release funds: ${error.message}. Request status remains ACCEPTED.`,
            ErrorCode.INTERNAL_ERROR
          );
        }
      }
    } else if (transaction.stripeTransferId) {
      console.log(`Transaction ${transaction.id} already has transfer ${transaction.stripeTransferId}, skipping fund release`);
    } else if (transaction.status !== 'paid' && transaction.status !== 'awaiting_transfer') {
      // Before throwing error, check Payment Intent status from Stripe
      if (transaction.stripePaymentIntentId) {
        try {
          const paymentIntent = await this.stripeService.getPaymentIntent(transaction.stripePaymentIntentId);
          if (paymentIntent.status === 'succeeded') {
            // Payment succeeded but status not updated yet - update it and proceed
            await this.transactionService.updateTransactionStatus(transaction.id, 'paid');
            // Retry the fund release
            try {
              await this.transactionService.releaseFundsFromStripe(transaction.id, user);
            } catch (error) {
              // If transfer fails due to onboarding, mark as awaiting_transfer and allow completion
              if (error.message.includes('transfers enabled') ||
                error.message.includes('onboarding') ||
                error.message.includes('capability')) {
                // Mark transaction as awaiting_transfer - funds will be released when payee completes onboarding
                await this.transactionService.updateTransactionStatus(transaction.id, 'awaiting_transfer');
                console.log(`Transaction ${transaction.id} marked as awaiting_transfer. Funds will be released when payee completes onboarding.`);
                // Allow request completion - funds are safely held by platform
              } else if (error.message.includes('insufficient') ||
                error.message.includes('available balance') ||
                error.message.includes('available funds')) {
                // NEW: Insufficient balance handling - mark as awaiting_available_funds and allow completion
                await this.transactionService.updateTransactionStatus(transaction.id, 'awaiting_available_funds');
                console.log(`Transaction ${transaction.id} marked as awaiting_available_funds. Funds will be released when platform balance becomes available.`);
                // Allow request completion - funds will be released when available
              } else {
                // For other errors, don't allow completion
                throw new CustomBadRequestException(
                  `Failed to release funds: ${error.message}. Request status remains ACCEPTED.`,
                  ErrorCode.INTERNAL_ERROR
                );
              }
            }
          } else {
            // Payment actually not succeeded
            console.log(`Transaction ${transaction.id} is ${transaction.status}, Payment Intent status: ${paymentIntent.status}. Payment not yet successful. Cannot release funds.`);
            throw new CustomBadRequestException(
              `Transaction payment is not yet successful (Payment Intent status: ${paymentIntent.status}). Cannot release funds.`,
              ErrorCode.INTERNAL_ERROR
            );
          }
        } catch (error) {
          // If we can't check Payment Intent, fall back to original behavior
          console.log(`Transaction ${transaction.id} is ${transaction.status}, payment not yet successful. Cannot release funds. Error checking Payment Intent: ${error.message}`);
          throw new CustomBadRequestException(
            `Transaction payment is not yet successful (status: ${transaction.status}). Cannot release funds.`,
            ErrorCode.INTERNAL_ERROR
          );
        }
      } else {
        // No Payment Intent - throw error as before
        console.log(`Transaction ${transaction.id} is ${transaction.status}, payment not yet successful. Cannot release funds.`);
        throw new CustomBadRequestException(
          `Transaction payment is not yet successful (status: ${transaction.status}). Cannot release funds.`,
          ErrorCode.INTERNAL_ERROR
        );
      }
    }

    // 4. Only update request status to completed if transfer succeeded
    const completedStatus = await this.requestStatusService.getRequestByStatus('COMPLETED');
    if (!completedStatus) {
      throw new NotFoundException('Completed status not found');
    }
    console.log("completed request status->", completedStatus)

    // Update the status ID directly on the entity
    request.currentStatusId = completedStatus.id;
    request.currentStatus = completedStatus;
    const savedRequest = await this.requestRepository.save(request);

    console.log("updates request ->", savedRequest)


    // 5. Add status history record (IMPORTANT: This was missing!)
    await this.requestStatusHistoryService.record(requestId, completedStatus.id);

    // 6. Clear cache for affected users (requester and travel/demand owner)
    const affectedUserIds = [user.id]; // Requester
    // getRequestById already loads travel and demand relations, so we can use them here
    if (request.travel) {
      affectedUserIds.push(request.travel.userId);
    } else if (request.demand) {
      affectedUserIds.push(request.demand.userId);
    }
    // Clear cache early so users see updated data
    await this.clearRequestListCacheForUsers(affectedUserIds);

    // 6. Fetch the request again with updated relations including currentStatus
    const updatedRequest = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['transactions', 'demand', 'travel', 'demand.user', 'travel.user', 'currentStatus', 'requester']
    });

    if (!updatedRequest) {
      throw new CustomNotFoundException('Updated Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }

    // 8. Send email to the requester
    this.userEventService.emitRequestCompleted(user, updatedRequest, false);

    // 9. Get user who published the travel or demand
    const travel = await this.userService.findOne({
      id: updatedRequest.travel!.userId,
    });

    // 10. Determine fund status from transaction for seller notification
    let fundStatus: 'pending_funds' | 'pending_onboarding' | 'released' | undefined = undefined;
    const updatedTransaction = await this.transactionService.getTransactionByRequestId(requestId);
    if (updatedTransaction) {
      if (updatedTransaction.stripeTransferId) {
        fundStatus = 'released';
      } else if (updatedTransaction.status === 'awaiting_available_funds') {
        fundStatus = 'pending_funds';
      } else if (updatedTransaction.status === 'awaiting_transfer') {
        fundStatus = 'pending_onboarding';
      }
    }

    //also send email to the user who published the travel or demand
    await this.userEventService.emitRequestCompletedForOwner(travel!, updatedRequest, true, fundStatus);

    return updatedRequest;
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
    await this.requestRepository.update(requestId, { currentStatusId: cancelledStatus.id });
    await this.requestStatusHistoryService.record(requestId, cancelledStatus.id);
    this.logger.log(`[Payment-failure] Loading requester: id=${request.requesterId}`);
    const requester = await this.userService.findOne({ id: request.requesterId });
    if (!requester) {
      this.logger.warn(
        `cancelRequestDueToPaymentFailure: requester not found for requestId=${requestId}, requesterId=${request.requesterId}. Payment-failure email not sent.`,
      );
    } else {
      this.logger.log(`[Payment-failure] Requester found: userId=${requester.id}, email=${requester.email ?? '(null)'}`);
      request.requester = requester;
      request.currentStatusId = cancelledStatus.id;
      request.currentStatus = cancelledStatus;
      const ownerId = request.travel?.userId ?? request.demand?.userId ?? 0;
      const eventPayload: RequestEvent = {
        userId: requester.id,
        userFirstName: requester.firstName,
        userEmail: requester.email,
        timestamp: new Date(),
        requesterId: request.requesterId,
        requesterName: `${requester.firstName} ${requester.lastName?.charAt(0) ?? ''}.`,
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
          requester.firstName,
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

      if (request.travel && request.travel.departureDatetime) {
        const travelDatetime = new Date(request.travel.departureDatetime);
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

    // 7. Restore weight to travel if request was for a travel
    if (request.travelId) {
      const travel = await this.travelService.findOne({
        where: { id: request.travelId }
      });

      if (travel) {
        // Convert to numbers to handle decimal/string type issues from TypeORM
        const travelWeightAvailable = Number(travel.weightAvailable) || 0;
        const requestWeight = Number(request.weight) || 0;

        // Add the request weight back to available weight
        const newAvailableWeight = travelWeightAvailable + requestWeight;

        // Update travel weight
        travel.weightAvailable = newAvailableWeight;

        // If travel was 'filled', change status back to 'active' since weight is now available
        if (travel.status === 'filled' && newAvailableWeight > 0) {
          travel.status = 'active';
        }

        await this.travelService.save(travel);
      }
    }

    // 8. Update request status based on action type
    if (isRequester) {
      // Cancellation by requester
      request.currentStatusId = cancelledStatus.id;
      request.currentStatus = cancelledStatus;
      await this.requestRepository.save(request);
      await this.requestStatusHistoryService.record(requestId, cancelledStatus.id);
    } else {
      // Rejection by owner
      request.currentStatusId = rejectedStatus.id;
      request.currentStatus = rejectedStatus;
      await this.requestRepository.save(request);
      await this.requestStatusHistoryService.record(requestId, rejectedStatus.id);
    }

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
   * Seller confirms cancellation of a request cancelled during/after travel date
   */
  async confirmCancellationBySeller(requestId: number, user: UserEntity): Promise<RequestEntity> {
    const request = await this.getRequestById(requestId);
    if (!request) {
      throw new CustomNotFoundException('Request not found', ErrorCode.REQUEST_NOT_FOUND);
    }

    // Validate seller is the travel/demand owner
    const isOwner = (request.travel && request.travel.userId === user.id) ||
      (request.demand && request.demand.userId === user.id);

    if (!isOwner) {
      throw new CustomForbiddenException(
        'Only the travel/demand owner can confirm cancellation',
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

    // Get cancelled status
    const cancelledStatus = await this.requestStatusService.getRequestByStatus('CANCELLED');
    if (!cancelledStatus) {
      throw new CustomNotFoundException('CANCELLED request status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    // Check if funds were already transferred
    const transaction = await this.transactionService.getTransactionByRequestId(requestId);
    let fundsAlreadyTransferred = false;
    if (transaction && transaction.stripeTransferId) {
      fundsAlreadyTransferred = true;
      // Notify admin - funds were already transferred, manual intervention needed
      this.logger.warn(
        `Cancellation confirmed but funds already transferred for request ${requestId}. Admin intervention required.`
      );
      // Still proceed with cancellation confirmation, but admin will need to handle refund manually
    }

    // Process refund if funds not yet transferred
    if (!fundsAlreadyTransferred && transaction) {
      if (transaction.status === 'paid' && transaction.stripePaymentIntentId) {
        try {
          let travelerPaymentUSD: number;
          if (transaction.travelerPayment !== null && transaction.travelerPayment !== undefined) {
            travelerPaymentUSD = await this.stripeService.convertToUSD(
              transaction.travelerPayment,
              transaction.currencyCode || 'USD'
            );
          } else {
            throw new CustomBadRequestException('Traveler payment amount not found in transaction', ErrorCode.INTERNAL_ERROR);
          }

          await this.stripeService.refundPaymentIntentPartial(
            transaction.stripePaymentIntentId,
            travelerPaymentUSD
          );

          await this.transactionService.updateTransactionStatus(transaction.id, 'refunded');
        } catch (error) {
          this.logger.error(`Failed to refund transaction ${transaction.id}: ${error.message}`);
          throw new CustomBadRequestException(
            `Failed to process refund: ${error.message}`,
            ErrorCode.INTERNAL_ERROR
          );
        }
      }
    }

    // Update request status and cancellation tracking
    request.currentStatusId = cancelledStatus.id;
    request.currentStatus = cancelledStatus;
    request.cancellationConfirmedAt = new Date();
    request.cancellationConfirmedBy = user.id;
    await this.requestRepository.save(request);
    await this.requestStatusHistoryService.record(requestId, cancelledStatus.id);

    // Restore weight to travel if applicable
    if (request.travelId) {
      const travel = await this.travelService.findOne({ where: { id: request.travelId } });
      if (travel) {
        const travelWeightAvailable = Number(travel.weightAvailable) || 0;
        const requestWeight = Number(request.weight) || 0;
        const newAvailableWeight = travelWeightAvailable + requestWeight;
        travel.weightAvailable = newAvailableWeight;
        if (travel.status === 'filled' && newAvailableWeight > 0) {
          travel.status = 'active';
        }
        await this.travelService.save(travel);
      }
    }

    // Send emails to both parties
    const requester = await this.userService.findOne({ id: request.requesterId });
    const ownerId = request.travelId ? request.travel.userId : (request.demandId ? request.demand.userId : null);
    
    if (requester && ownerId) {
      this.userEventService.emitCancellationConfirmed(user, request, ownerId);
    }

    // Clear cache
    await this.clearRequestListCache();

    return request;
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

    // Set dispute timestamp
    request.cancellationDisputedAt = new Date();
    request.cancellationConfirmedBy = user.id;
    await this.requestRepository.save(request);

    // Send email to admin with dispute details
    const ownerId = request.travelId ? request.travel.userId : (request.demandId ? request.demand.userId : null);
    if (ownerId) {
      this.userEventService.emitCancellationDisputed(user, request, ownerId);
    }

    // Send email to buyer
    const requester = await this.userService.findOne({ id: request.requesterId });
    if (requester && ownerId) {
      // Emit event for buyer notification
      const buyerEvent: RequestEvent = {
        userId: requester.id,
        userFirstName: requester.firstName,
        userEmail: requester.email,
        timestamp: new Date(),
        requesterId: request.requesterId,
        requesterName: `${requester.firstName} ${requester.lastName?.charAt(0) ?? ''}.`,
        ownerId: ownerId,
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
  async autoCompleteRequests(): Promise<{ completed: number; errors: number }> {
    const autoCompleteDays = this.configService.get<number>('AUTO_COMPLETE_DAYS_AFTER_TRAVEL_DATE', 7);
    const acceptedStatus = await this.requestStatusService.getRequestByStatus('ACCEPTED');
    if (!acceptedStatus) {
      this.logger.error('ACCEPTED status not found');
      return { completed: 0, errors: 0 };
    }

    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - autoCompleteDays);

    // Find requests that should be auto-completed
    const requestsToComplete = await this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.travel', 'travel')
      .leftJoinAndSelect('request.demand', 'demand')
      .leftJoinAndSelect('request.requester', 'requester')
      .where('request.currentStatusId = :acceptedStatusId', { acceptedStatusId: acceptedStatus.id })
      .andWhere(
        '(travel.departureDatetime IS NOT NULL AND DATE(travel.departureDatetime) <= DATE(:cutoffDate)) OR ' +
        '(demand.travelDate IS NOT NULL AND DATE(demand.travelDate) <= DATE(:cutoffDate))',
        { cutoffDate: cutoffDate.toISOString().split('T')[0] }
      )
      .getMany();

    let completed = 0;
    let errors = 0;

    for (const request of requestsToComplete) {
      try {
        const requester = await this.userService.findOne({ id: request.requesterId });
        if (!requester) {
          this.logger.warn(`Requester not found for request ${request.id}`);
          errors++;
          continue;
        }

        // Complete the request (similar to completeRequest but without user validation)
        const completedStatus = await this.requestStatusService.getRequestByStatus('COMPLETED');
        if (!completedStatus) {
          this.logger.error('COMPLETED status not found');
          errors++;
          continue;
        }

        // Release funds if not already released
        const transaction = await this.transactionService.getTransactionByRequestId(request.id);
        if (transaction && !transaction.stripeTransferId && (transaction.status === 'paid' || transaction.status === 'awaiting_transfer' || transaction.status === 'awaiting_available_funds')) {
          try {
            // Use the same logic as completeRequest for fund release
            const payee = request.travelId 
              ? await this.userService.findOne({ id: request.travel.userId })
              : (request.demandId ? await this.userService.findOne({ id: request.demand.userId }) : null);
            
            if (payee) {
              await this.transactionService.releaseFundsFromStripe(transaction.id, payee);
            }
          } catch (error) {
            this.logger.warn(`Failed to release funds for transaction ${transaction.id}: ${error.message}`);
            // Continue with completion even if fund release fails (similar to completeRequest error handling)
            // Transaction may be marked as awaiting_transfer or awaiting_available_funds
          }
        }

        // Update request status
        request.currentStatusId = completedStatus.id;
        request.currentStatus = completedStatus;
        await this.requestRepository.save(request);
        await this.requestStatusHistoryService.record(request.id, completedStatus.id);

        // Send emails to both parties
        const ownerId = request.travelId ? request.travel.userId : (request.demandId ? request.demand.userId : null);
        if (ownerId) {
          const owner = await this.userService.findOne({ id: ownerId });
          if (owner) {
            this.userEventService.emitRequestAutoCompleted(requester, request, false, ownerId);
            this.userEventService.emitRequestAutoCompleted(owner, request, true, ownerId);
          }
        }

        completed++;
      } catch (error) {
        this.logger.error(`Failed to auto-complete request ${request.id}: ${error.message}`);
        errors++;
      }
    }

    this.logger.log(`Auto-completion completed: ${completed} requests completed, ${errors} errors`);
    return { completed, errors };
  }

  // Helper method for travel requests
  private async handleTravelRequestAcceptance(request: RequestEntity): Promise<void> {
    const travel = await this.travelService.findOne({
      where: { id: request.travelId! }
    });

    if (!travel) {
      throw new CustomNotFoundException('Travel not found', ErrorCode.TRAVEL_NOT_FOUND);
    }

    // Convert to numbers to handle decimal/string type issues from TypeORM
    const travelWeightAvailable = Number(travel.weightAvailable) || 0;
    const requestWeight = Number(request.weight) || 0;

    // Subtract the request weight from available weight
    const newAvailableWeight = travelWeightAvailable - requestWeight;

    if (newAvailableWeight < 0) {
      throw new CustomBadRequestException(
        `Insufficient weight available in travel. Only ${travelWeightAvailable}kg available, but ${requestWeight}kg requested.`,
        ErrorCode.INSUFFICIENT_WEIGHT_AVAILABLE_IN_TRAVEL
      );
    }

    // Update travel weight
    travel.weightAvailable = newAvailableWeight;

    // Check if travel is now filled (use small epsilon for floating point comparison)
    if (Math.abs(newAvailableWeight) < 0.01) {
      travel.status = 'filled';
    }

    await this.travelService.save(travel);
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
      maxWeight
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
      queryBuilder.andWhere('currentStatus.status = :status', { status });
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

    // Transform the data to include only relevant fields (async transformation)
    const transformedItems = await Promise.all(
      items.map(request => {
        const unreadCount = unreadCountsMap.get(request.id) || 0;
        return this.transformRequestToResponse(request, unreadCount, user);
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
      maxWeight
    } = query;

    return `requests_list_user${userId}_page${page}_limit${limit}_id${id || 'all'}_requester${requesterId || 'all'}_travel${travelId || 'all'}_demand${demandId || 'all'}_type${requestType || 'all'}_desc${packageDescription || 'all'}_minWeight${minWeight || 'all'}_maxWeight${maxWeight || 'all'}_date${limitDate || 'all'}_status${status || 'all'}_order${orderBy}`;
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
      relations: ['demand', 'travel', 'demand.user', 'travel.user', 'requester', 'currentStatus', 'requestStatusHistory', 'transactions', 'messages'],
    });
  }

  async findOne(arg: FindOptionsWhere<RequestEntity>): Promise<RequestEntity | null> {
    return await this.requestRepository.findOne({
      where: arg,
      relations: ['demand', 'travel', 'requestStatusHistory', 'transactions', 'messages'],
    });
  }
  async transformRequestToResponse(request: RequestEntity, unreadCount: number = 0, currentUser?: UserEntity): Promise<RequestResponseDto> {
    // Format requester fullName
    const requesterFullName = request.requester
      ? this.commonService.formatFullName(request.requester.firstName, request.requester.lastName)
      : '';

    // Build requester object with fullName and profilePictureUrl
    const requester: UserResponseDto = request.requester ? {
      id: request.requester.id,
      firstName: request.requester.firstName,
      lastName: request.requester.lastName,
      fullName: requesterFullName,
      email: request.requester.email,
      profilePictureUrl: request.requester.profilePictureUrl || null
    } : {
      id: request.requesterId,
      firstName: '',
      lastName: '',
      fullName: '',
      email: '',
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
      demand: request.demand || null,
      currency: currency,
      unReadMessages: unreadCount,
      canReview
    };
  }

  /**
   * Helper method to get unread counts for requests
   * Wraps MessageService call to avoid circular dependency issues
   */
  async getUnreadCountsForRequests(requestIds: number[], userId: number): Promise<Map<number, number>> {
    return this.messageService.getUnreadCountsByRequestIds(requestIds, userId);
  }
}
