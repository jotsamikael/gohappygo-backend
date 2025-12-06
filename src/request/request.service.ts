import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { FilePurpose } from 'src/uploaded-file/uploaded-file-purpose.enum';
import { FindRequestsQueryDto } from './dto/findRequestsQuery.dto';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
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

@Injectable()
export class RequestService {
  private requestListCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(RequestEntity) private requestRepository: Repository<RequestEntity>,
    private requestStatusHistoryService: RequestStatusHistoryService,
    private requestStatusService: RequestStatusService,
    private travelService: TravelService,
    private demandService: DemandService,
    private transactionService: TransactionService,
    private readonly userEventService: UserEventsService,
    private readonly fileUploadService: FileUploadService,
    private readonly userService: UserService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly requestMapper: RequestMapper
  ) { }

  //createRequest to seek travel - Updated to only require weight
  async createRequestToTravel(createRequestDto: CreateRequestToTravelDto, user: UserEntity): Promise<RequestEntity> {
    //check if user account is verified
    if(!user.isVerified){
      throw new CustomBadRequestException('Your account is not verified', ErrorCode.USER_NOT_VERIFIED);
    }

    //check if travel is created by the same user as the requester
    if(createRequestDto.travelId && createRequestDto.travelId === user.id) {
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
    
    console.log('reached1', travel);
    // Use a transaction to ensure atomicity
    return await this.requestRepository.manager.transaction(async (transactionalEntityManager) => {
      const request = transactionalEntityManager.create(RequestEntity, {
        travelId: createRequestDto.travelId,
        demandId: null,
        requestType: createRequestDto.requestType,
        weight: createRequestDto.weight,
        createdBy: user.id,
        requesterId: user.id, // Add this field
        requester: user
      });
      console.log('reached2');

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
      
      const savedRequest = await transactionalEntityManager.save(RequestEntity, request);
      console.log('reached3', savedRequest);

      // Add status history record using the transactional entity manager
      const statusHistoryRecord = transactionalEntityManager.create(RequestStatusHistoryEntity, {
        requestId: savedRequest.id,
        requestStatusId: reqStatus!.id
      });
      await transactionalEntityManager.save(RequestStatusHistoryEntity, statusHistoryRecord);
      console.log('reached4 - after status history');

      // Clear cache
      await this.clearRequestListCache();
      console.log('reached5 - after cache clear');

      // If it's an instant travel, automatically process the acceptance
      if (travel.isInstant) { 
        console.log('reached6 - processing instant travel');
        // Load the request with all necessary relations for instant processing
        const requestWithRelations = await transactionalEntityManager.findOne(RequestEntity, {
          where: { id: savedRequest.id },
          relations: ['travel', 'travel.user', 'demand', 'demand.user', 'requester']
        });
        console.log('reached7 - loaded relations');
        
        await this.processInstantTravelAcceptance(requestWithRelations!, travel, transactionalEntityManager);
        console.log('reached8 - after instant processing');
      }

      // emit request created event (non-blocking)
      console.log('reached9 - emitting events');
      this.userEventService.emitRequestCreated(user, savedRequest, false, travel.userId);

      //also send email to the user who published the travel (non-blocking)
      this.userEventService.emitRequestCreated(travel.user!, savedRequest, true, travel.userId);
      console.log('reached10 - events emitted');

      return savedRequest;
    });
  }

  // New method to handle instant travel acceptance
  private async processInstantTravelAcceptance(request: RequestEntity, travel: any, transactionalEntityManager: any): Promise<void> {
    try {
      console.log('processInstantTravelAcceptance - start');
      
      // Update travel weight availability
      const newAvailableWeight = travel.weightAvailable - (request.weight || 0);
      travel.weightAvailable = newAvailableWeight;

      // Check if travel is now filled
      if (newAvailableWeight === 0) {
        travel.status = 'filled';
      }

      console.log('processInstantTravelAcceptance - before travel save');
      // Use the transactional entity manager instead of the service
      await transactionalEntityManager.save('TravelEntity', travel);
      console.log('processInstantTravelAcceptance - after travel save');

      // Create transaction automatically for instant travels
      const transactionAmount = (request.weight || 0) * travel.pricePerKg * 1.24 + 10;
      
      console.log('processInstantTravelAcceptance - before transaction creation');
      // Create transaction using the transactional entity manager
      const transaction = transactionalEntityManager.create('TransactionEntity', {
        requestId: request.id,
        payerId: request.requesterId,
        payeeId: travel.user.id, // Use the travel's user ID
        status: 'pending',
        paymentMethod: 'platform',
        amount: transactionAmount
      });
      await transactionalEntityManager.save('TransactionEntity', transaction);
      console.log('processInstantTravelAcceptance - after transaction creation');

      // Emit request accepted event for instant travels (non-blocking)
      console.log('processInstantTravelAcceptance - before event emission');
      this.userEventService.emitRequestAccepted(travel.user!, request, false, travel.userId);
      this.userEventService.emitRequestAccepted(request.requester!, request, true, travel.userId);
      console.log('processInstantTravelAcceptance - after event emission');

    } catch (error) {
      console.error('Error processing instant travel acceptance:', error);
      throw new   CustomBadRequestException(`Failed to process instant travel acceptance: ${error.message}`, ErrorCode.INTERNAL_ERROR);
    }
  }

  


async acceptRequest(requestId: number, user: UserEntity): Promise<any> {
  // 1. Find the request with all necessary relations including currentStatus
  const request = await this.requestRepository.findOne({
    where: { id: requestId },
    relations: ['demand', 'travel', 'demand.user', 'travel.user', 'currentStatus']
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

  // 7. Update request status
  request.currentStatusId = acceptedStatus.id;
  await this.requestRepository.save(request);

  // 8. Add status history record
  await this.requestStatusHistoryService.record(requestId, acceptedStatus.id);

  // 9. Handle business logic based on request type
  if (request.travelId) {
    // Request was addressed to a travel - update travel weight
    await this.handleTravelRequestAcceptance(request);
  } else if (request.demandId) {
    // Request was addressed to a demand - update demand status
    await this.handleDemandRequestAcceptance(request);
  }

  // 10. Create transaction automatically
  //calculate transaction amount based on request weight and travel price per kg + tva (24 %) + plateform fee (10 usd)
  const transactionAmount = (request.weight || 0) * request.travel.pricePerKg * 1.24 + 10;

  await this.transactionService.createTransactionFromRequest(request, transactionAmount);

  // 11. emit request accepted event (send email to traveler who published the travel)
   this.userEventService.emitRequestAccepted(user, request, false, request.travel.userId);

   //get the requester
   const requester = await this.userService.findOne({ 
     id: request.requesterId,
  });
   //send email to the requester
   await this.userEventService.emitRequestAccepted(requester!, request, true, request.travel.userId);

  // Reload request with all relations for mapping
  const updatedRequest = await this.requestRepository.findOne({
    where: { id: requestId },
    relations: ['travel', 'travel.user', 'demand']
  });

  return this.requestMapper.toAcceptResponseDto(updatedRequest!);
}
  

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

  // 2. Update request status to completed
  const completedStatus = await this.requestStatusService.getRequestByStatus('COMPLETED');
  if (!completedStatus) {
    throw new NotFoundException('Completed status not found');
  }
  console.log("completed request status->",completedStatus)
  
  // Update the status ID directly on the entity
  request.currentStatusId = completedStatus.id;
  request.currentStatus = completedStatus;
  const savedRequest = await this.requestRepository.save(request);

  console.log("updates request ->",savedRequest)

  
  // 3. Add status history record (IMPORTANT: This was missing!)
  await this.requestStatusHistoryService.record(requestId, completedStatus.id);
  
  // 4. Clear cache to ensure fresh data on next query
  await this.clearRequestListCache();

  //get transaction by request id
  const transaction = await this.transactionService.getTransactionByRequestId(requestId);
  if (!transaction) {
    throw new CustomNotFoundException('Transaction not found', ErrorCode.TRANSACTION_NOT_FOUND);
  }

  // 5. Release funds from stripe to payee (only if pending)
  if (transaction.status === 'pending') {
    await this.transactionService.releaseFundsFromStripe(transaction.id, user);
  } else {
    console.log(`Transaction ${transaction.id} is already ${transaction.status}, skipping fund release`);
  }

  // 6. Fetch the request again with updated relations including currentStatus
  const updatedRequest = await this.requestRepository.findOne({
    where: { id: requestId },
    relations: ['transactions', 'demand', 'travel', 'demand.user', 'travel.user', 'currentStatus', 'requester']
  });

  if (!updatedRequest) {
    throw new CustomNotFoundException('Updated Request not found', ErrorCode.REQUEST_NOT_FOUND);
  }

  // 7. Send email to the requester
  this.userEventService.emitRequestCompleted(user, updatedRequest, false);

  //get user who published the travel or demand
  const travel = await this.userService.findOne({
    id: updatedRequest.travel!.userId,
  });
  //also send email to the user who published the travel or demand
  await this.userEventService.emitRequestCompletedForOwner(travel!, updatedRequest, true);

  return updatedRequest;
}

// Helper method for travel requests
private async handleTravelRequestAcceptance(request: RequestEntity): Promise<void> {
  const travel = await this.travelService.findOne({
    where: { id: request.travelId! }
  });

  if (!travel) {
    throw new CustomNotFoundException('Travel not found', ErrorCode.TRAVEL_NOT_FOUND);
  }

  // Subtract the request weight from available weight
  const newAvailableWeight = travel.weightAvailable - (request.weight || 0);
  
  if (newAvailableWeight < 0) {
    throw new CustomBadRequestException('Insufficient weight available in travel', ErrorCode.INSUFFICIENT_WEIGHT_AVAILABLE_IN_TRAVEL);
  }

  // Update travel weight
  travel.weightAvailable = newAvailableWeight;

  // Check if travel is now filled
  if (newAvailableWeight === 0) {
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
      .leftJoinAndSelect('request.demand', 'demand')
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

    // Transform the data to include only relevant fields
    const transformedItems = items.map(request => this.transformRequestToResponse(request));

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

    await this.cacheManager.set(cacheKey, responseResult, 30000);
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

  // Add cache clearing method
  private async clearRequestListCache(): Promise<void> {
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
      relations: ['demand', 'travel','demand.user', 'travel.user','requester', 'currentStatus', 'requestStatusHistory', 'transactions', 'messages'],
    });
  }

  async findOne(arg: FindOptionsWhere<RequestEntity>): Promise<RequestEntity | null> {
    return await this.requestRepository.findOne({
      where: arg,
      relations: ['demand', 'travel', 'requestStatusHistory', 'transactions', 'messages'],
    });
  }
  private transformRequestToResponse(request: RequestEntity): RequestResponseDto {
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
      requester: {
        id: request.requester?.id,
        firstName: request.requester?.firstName,
        lastName: request.requester?.lastName,
        email: request.requester?.email
      } as UserResponseDto,
     
      currentStatus: {
        status: request.currentStatus?.status
      } as StatusResponseDto,
      travel: request.travel || null,
      demand: request.demand || null
    };
  }
}
