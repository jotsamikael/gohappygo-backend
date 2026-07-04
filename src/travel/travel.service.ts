import { BadRequestException, Inject, Injectable, NotAcceptableException, NotFoundException, forwardRef } from '@nestjs/common';
import { TravelEntity } from './travel.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { UserEntity } from 'src/user/user.entity';
import { Repository } from 'typeorm';
import { FindTravelsQueryDto } from './dto/findTravelsQuery.dto';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CreateTravelDto } from './dto/createTravel.dto';
import { UpdateTravelDto } from './dto/updateTravel.dto';
import { FilePurpose } from 'src/uploaded-file/uploaded-file-purpose.enum';
import { UserEventsService } from 'src/events/user-events.service';
import { AirlineService } from 'src/airline/airline.service';
import { CurrencyService } from 'src/currency/currency.service';
import { TravelMapper } from './travel.mapper';
import { ReviewService } from 'src/review/review.service';
import { BookmarkService } from 'src/bookmark/bookmark.service';
import { TravelDetailResponseDto } from './dto/travel-detail.response.dto';
import { TravelResponseDto } from './dto/travel-response.dto';
import { CustomNotFoundException, CustomBadRequestException, CustomForbiddenException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { ReviewEntity } from 'src/review/review.entity';
import { RequestEntity } from 'src/request/request.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { RequestStatusService } from 'src/request-status/request-status.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { RequestStatusHistoryService } from 'src/request-status-history/request-status-history.service';
import { TransactionService } from 'src/transaction/transaction.service';
import { StripeService } from 'src/stripe/stripe.service';
import { UserService } from 'src/user/user.service';
import { RequestStatusHistoryEntity } from 'src/request-status-history/RequestStatusHistory.entity';
import { RequestListingCancellationService } from 'src/request-listing-cancellation/request-listing-cancellation.service';
@Injectable()
export class TravelService {
 
  
 
  private travelListCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(TravelEntity) private travelRepository: Repository<TravelEntity>,
    @InjectRepository(ReviewEntity) private reviewRepository: Repository<ReviewEntity>,
    @InjectRepository(RequestEntity) private requestRepository: Repository<RequestEntity>,
    @InjectRepository(TransactionEntity) private transactionRepository: Repository<TransactionEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly fileUploadService: FileUploadService,
    private readonly userEventService: UserEventsService,
    private readonly airlineService: AirlineService,
    private readonly travelMapper: TravelMapper,
    private readonly requestStatusService: RequestStatusService,
    private readonly requestStatusHistoryService: RequestStatusHistoryService,
    @Inject(forwardRef(() => TransactionService))
    private readonly transactionService: TransactionService,
    @Inject(forwardRef(() => StripeService))
    private readonly stripeService: StripeService,
    private readonly userService: UserService,
    private readonly requestListingCancellationService: RequestListingCancellationService,
  ) { }

  private generateTravelsListCacheKey(query: FindTravelsQueryDto): string {
    const { 
      page = 1, 
      limit = 10, 
      description,
      flightNumber,
      airlineId,
      departureAirportId,
      arrivalAirportId,
      userId,
      weightAvailable,
      isSharedWeight,
      isInstant,
      isAllowExtraWeight,
      status,
      departureDate,
      orderBy = 'createdAt:desc'
    } = query;
    
    return `travels_list_page${page}_limit${limit}_desc${description || 'all'}_flight${flightNumber || 'all'}_airline${airlineId || 'all'}_origin${departureAirportId || 'all'}_dest${arrivalAirportId || 'all'}_user${userId || 'all'}_weightAvail${weightAvailable || 'all'}_shared${isSharedWeight !== undefined ? isSharedWeight : 'all'}_instant${isInstant !== undefined ? isInstant : 'all'}_extraWeight${isAllowExtraWeight !== undefined ? isAllowExtraWeight : 'all'}_status${status || 'all'}_depDate${departureDate || 'all'}_order${orderBy}`;
  }

 

  async getTravelsByFlightNumber(flightNumber: string): Promise<TravelEntity[]> {
    const travels = await this.travelRepository.findBy({ flightNumber: flightNumber });
    if (!travels) {
      throw new NotFoundException(`No travel with flight number: ${flightNumber} not found`);
    }

    return travels;
  }

  async getAllTravels(query: FindTravelsQueryDto): Promise<PaginatedResponse<TravelResponseDto>> {
    //generate cache key
    const cacheKey = this.generateTravelsListCacheKey(query);
    //add cache key to memory
    this.travelListCacheKeys.add(cacheKey)

    //get data from cache
    const getCachedData = await this.cacheManager.get<PaginatedResponse<TravelResponseDto>>(cacheKey);
    if (getCachedData) {
      console.log(`Cache Hit---------> Returning travels list from Cache ${cacheKey}`)
      return getCachedData
    }
    console.log(`Cache Miss---------> Returning travels list from database`)
    const {
      page = 1,
      limit = 10,
      description,
      flightNumber,
      airlineId,
      departureAirportId,
      arrivalAirportId,
      userId,
      weightAvailable,
      isSharedWeight,
      isInstant,
      isAllowExtraWeight,
      status,
      departureDate,
      orderBy = 'createdAt:desc'
    } = query;


    const skip = (page - 1) * limit;

    const queryBuilder = this.travelRepository.createQueryBuilder('travel')
      .skip(skip)
      .take(limit);

    // Always exclude cancelled travels from the list
    queryBuilder.andWhere("travel.status != :cancelledStatus", { cancelledStatus: 'cancelled' });

    // Apply filters with debugging
    if (description) {
      queryBuilder.andWhere('LOWER(travel.description) LIKE LOWER(:description)', { description: `%${description}%` });
      console.log('🔍 Debug - Added description filter:', description);
    }

    if (flightNumber) {
      queryBuilder.andWhere('travel.flightNumber = :flightNumber', { flightNumber });
      console.log('🔍 Debug - Added flightNumber filter:', flightNumber);
    }

    if (airlineId) {
      queryBuilder.andWhere('travel.airlineId = :airlineId', { airlineId });
      console.log('🔍 Debug - Added airlineId filter:', airlineId);
    }

    if (departureAirportId) {
      queryBuilder.andWhere('travel.departureAirportId = :departureAirportId', { departureAirportId });
      console.log('🔍 Debug - Added departureAirportId filter:', departureAirportId);
    }

    if (arrivalAirportId) {
      queryBuilder.andWhere('travel.arrivalAirportId = :arrivalAirportId', { arrivalAirportId });
      console.log('🔍 Debug - Added arrivalAirportId filter:', arrivalAirportId);
    }

    if (userId) {
      queryBuilder.andWhere('travel.userId = :userId', { userId });
      console.log('🔍 Debug - Added userId filter:', userId);
    }

    if (weightAvailable) {
      queryBuilder.andWhere('travel.weightAvailable >= :weightAvailable', { weightAvailable });
      console.log('🔍 Debug - Added weightAvailable filter:', weightAvailable);
    }

    if (isSharedWeight !== undefined) {
      const boolValue = isSharedWeight ? 1 : 0;
      queryBuilder.andWhere('travel.isSharedWeight = :isSharedWeight', { isSharedWeight: boolValue });
      console.log('🔍 Debug - Added isSharedWeight filter:', isSharedWeight, '->', boolValue);
    }

    if (isInstant !== undefined) {
      const boolValue = isInstant ? 1 : 0;
      queryBuilder.andWhere('travel.isInstant = :isInstant', { isInstant: boolValue });
      console.log('🔍 Debug - Added isInstant filter:', isInstant, '->', boolValue);
    }

    if (isAllowExtraWeight !== undefined) {
      const boolValue = isAllowExtraWeight ? 1 : 0;
      queryBuilder.andWhere('travel.isAllowExtraWeight = :isAllowExtraWeight', { isAllowExtraWeight: boolValue });
      console.log('🔍 Debug - Added isAllowExtraWeight filter:', isAllowExtraWeight, '->', boolValue);
    }

    if (status) {
      queryBuilder.andWhere('travel.status = :status', { status });
      console.log('🔍 Debug - Added status filter:', status);
    }

    if (departureDate) {
      // Prefer travelDate, fallback to departureDatetime during migration
      queryBuilder.andWhere('DATE(COALESCE(travel.travelDate, travel.departureDatetime)) = DATE(:departureDate)', { departureDate });
      console.log('🔍 Debug - Added departureDate filter:', departureDate);
    }

    // Apply sorting
    const [sortField, sortDirection] = orderBy.split(':');
    const validSortFields = ['createdAt', 'departureDatetime', 'pricePerKg', 'weightAvailable'];
    const validSortDirections = ['asc', 'desc'];

    if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      if (sortField === 'pricePerKg') {
        // Sort by USD-normalized price using currency.exchangeRate (fresh rates)
        queryBuilder
          .leftJoin('travel.currency', 'currencySort')
          .orderBy('(travel.pricePerKg * COALESCE(currencySort.exchangeRate, 1))', sortDirection.toUpperCase() as 'ASC' | 'DESC');
      } else {
        queryBuilder.orderBy(`travel.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
      }
      console.log('Added sorting:', orderBy);
    } else {
      queryBuilder.orderBy('travel.createdAt', 'DESC'); // default
      console.log('Added default sorting: createdAt:DESC');
    }

    // Get the count first (without joins to avoid complex queries)
    // Log query details to verify filters are applied
    if (airlineId) {
      console.log('🔍 Travel COUNT Query - Filtering by airlineId:', airlineId);
    }
    console.log('🔍 Travel COUNT Query SQL:', queryBuilder.getSql());
    console.log('🔍 Travel COUNT Query Params:', queryBuilder.getParameters());
    
    let totalItems: number;
    try {
      totalItems = await queryBuilder.getCount();
      console.log('🔍 Travel COUNT Result:', totalItems);
    } catch (error) {
      console.error('❌ Error executing travel COUNT query:', error);
      throw error;
    }

    // Now add the joins for the actual data
    queryBuilder
      .leftJoinAndSelect('travel.user', 'user')
      .leftJoinAndSelect('travel.departureAirport', 'departureAirport')
      .leftJoinAndSelect('travel.arrivalAirport', 'arrivalAirport')
      .leftJoinAndSelect('travel.airline', 'airline')
      .leftJoinAndSelect('travel.currency', 'currency')
      .leftJoinAndSelect('travel.images', 'images')
      // Add COUNT subquery for requests to determine isEditable
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(request.id)', 'requestCount')
          .from(RequestEntity, 'request')
          .where('request.travelId = travel.id');
      }, 'requestCount');

    // Use getRawAndEntities to get both entities and raw data (including requestCount)
    const { entities, raw } = await queryBuilder.getRawAndEntities();
    console.log('🔍 Debug - Final items found:', entities.length);

    // Debug currency in entities before mapping
    if (entities.length > 0) {
      const firstEntity = entities[0];
      console.log('🔍 Debug - Travel entity before mapping:', {
        travelId: firstEntity.id,
        hasCurrency: !!(firstEntity as any).currency,
        currency: (firstEntity as any).currency,
        currencyId: (firstEntity as any).currencyId,
        currencyKeys: (firstEntity as any).currency ? Object.keys((firstEntity as any).currency) : null
      });
    }

    const requestCountByTravelId = this.buildRequestCountMap(raw);

    // Add isEditable property to each travel entity and transform to DTOs
    const itemsWithIsEditable = entities.map((travel: TravelEntity) => {
      const requestCount = requestCountByTravelId.get(travel.id) ?? 0;
      return {
        ...travel,
        isEditable: this.isTravelEditable(travel, requestCount),
      } as TravelEntity & { isEditable: boolean };
    });

    // Transform entities to DTOs using mapper
    const mappedItems = this.travelMapper.toListResponseDtoArray(itemsWithIsEditable);
    
    // Debug currency in DTOs after mapping
    if (mappedItems.length > 0) {
      const firstMapped = mappedItems[0];
      console.log('🔍 Debug - Travel DTO after mapping:', {
        travelId: firstMapped.id,
        hasCurrency: 'currency' in firstMapped,
        currency: (firstMapped as any).currency,
        currencyId: firstMapped.currencyId,
        allKeys: Object.keys(firstMapped)
      });
    }

    const totalPages = Math.ceil(totalItems / limit);

    const responseResult: PaginatedResponse<TravelResponseDto> = {
      items: mappedItems,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages
      }
    }
    await this.cacheManager.set(cacheKey, responseResult, 30000);
    return responseResult;

  }

  async publishTravel(user: UserEntity, createTravelDto: CreateTravelDto, image1: Express.Multer.File, image2: Express.Multer.File): Promise<TravelEntity> {
    //check if user account is verified
    /*if (!user.isVerified) {
      throw new CustomBadRequestException('Your account is not verified', ErrorCode.USER_NOT_VERIFIED);
    }*/

    // Check if departure and arrival airports are the same
    if (createTravelDto.departureAirportId === createTravelDto.arrivalAirportId) {
      throw new CustomBadRequestException('Departure and arrival airports cannot be the same', ErrorCode.VALIDATION_ERROR);
    }

    const departureDatetime = new Date(createTravelDto.departureDatetime);

    const existingTravelByFlight = await this.findActiveTravelDuplicateByFlight({
      userId: user.id,
      flightNumber: createTravelDto.flightNumber,
      departureDatetime,
    });
    if (existingTravelByFlight) {
      throw new CustomBadRequestException(
        'You have already published an active travel with the same flight number on this departure date',
        ErrorCode.TRAVEL_ALREADY_EXISTS,
      );
    }

    const existingTravelByRoute = await this.findActiveTravelDuplicateByRoute({
      userId: user.id,
      departureAirportId: createTravelDto.departureAirportId,
      arrivalAirportId: createTravelDto.arrivalAirportId,
      departureDatetime,
    });
    if (existingTravelByRoute) {
      throw new CustomBadRequestException(
        'You have already published an active travel on the same route on this departure date',
        ErrorCode.TRAVEL_ALREADY_EXISTS,
      );
    }

    // Get airline from flight number
    const airline = await this.airlineService.findByFlightNumber(createTravelDto.flightNumber);
    const airlineId = airline?.id || undefined;

    // Create the travel first
    const newTravel = await this.travelRepository.create({
      userId: user.id,
      description: createTravelDto.description,
      flightNumber: createTravelDto.flightNumber,
      airlineId: airlineId,
      currencyId: createTravelDto.currencyId,
      isSharedWeight: createTravelDto.isSharedWeight,
      isInstant: createTravelDto.isInstant,
      isAllowExtraWeight: createTravelDto.isAllowExtraWeight,
      punctualityLevel: createTravelDto.punctualityLevel ?? false,
      feeForGloomy: createTravelDto.feeForGloomy,
      departureAirportId: createTravelDto.departureAirportId,
      arrivalAirportId: createTravelDto.arrivalAirportId,
      // Write both fields during migration: travelDate (new) and departureDatetime (legacy)
      departureDatetime,
      travelDate: departureDatetime,
      pricePerKg: createTravelDto.pricePerKg,
      totalWeightAllowance: createTravelDto.totalWeightAllowance,
      weightAvailable: createTravelDto.totalWeightAllowance,
      createdBy: user.id,
      status: 'active',
      user: user
    });

    const savedTravel = await this.travelRepository.save(newTravel);

    try {
      // Upload both images with travel association
      await this.fileUploadService.uploadMultipleFiles(
        [image1, image2],
        [FilePurpose.TRAVEL_IMAGE_1, FilePurpose.TRAVEL_IMAGE_2],
        user,
        savedTravel, // travel entity
        undefined // demand entity
      );

      // Clear cache for travel lists
      await this.clearTravelListCache();

      // Fetch the travel with populated relations for the email
      const travelWithRelations = await this.travelRepository.findOne({
        where: { id: savedTravel.id },
        relations: ['departureAirport', 'arrivalAirport', 'currency']
      });

      // emit travel created event with populated data
      this.userEventService.emitTravelPublished(user, travelWithRelations || savedTravel);

      return savedTravel;
    } catch (error) {

          // Handle foreign key constraint errors
          if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) {
            if (error.sqlMessage.includes('departureAirportId')) {
                throw new CustomBadRequestException(`Departure airport with ID ${createTravelDto.departureAirportId} does not exist`, ErrorCode.VALIDATION_ERROR);
            } else if (error.sqlMessage.includes('arrivalAirportId')) {
                throw new CustomBadRequestException(`Arrival airport with ID ${createTravelDto.arrivalAirportId} does not exist`, ErrorCode.VALIDATION_ERROR);
            } else {
                throw new CustomBadRequestException('Invalid airport reference. Please check airport IDs', ErrorCode.VALIDATION_ERROR);
            }
        }
        
        // Handle other database errors
        if (error.code === 'ER_DUP_ENTRY') {
            throw new CustomBadRequestException('A demand with this flight number already exists', ErrorCode.TRAVEL_ALREADY_EXISTS);
        }
        
        // Handle image upload errors
        if (error.message && error.message.includes('Failed to upload images')) {
            throw error; // Re-throw image upload errors as they already have proper messages
        }
      // If image upload fails, delete the created travel
      await this.travelRepository.remove(savedTravel);
      throw new CustomBadRequestException(`Failed to upload images: ${error.message}`, ErrorCode.INTERNAL_ERROR);
    }
  }

  async cancelTravel(id: number, user?: UserEntity): Promise<TravelEntity> {
    // 1. Find the travel with all necessary relations
    const travel = await this.travelRepository.findOne({
      where: { id },
      relations: [
        'requests', 
        'requests.currentStatus', 
        'requests.transactions',
        'requests.requester'
      ],
    });

    if (!travel) {
      throw new CustomNotFoundException(`Travel with id ${id} not found`, ErrorCode.TRAVEL_NOT_FOUND);
    }

    // 2. Check if user is provided and verify ownership (if user is provided)
    if (user) {
      // Check if user account is verified
      /*if (!user.isVerified) {
        throw new CustomBadRequestException('Your account is not verified', ErrorCode.USER_NOT_VERIFIED);
      }*/

      // Check if user is the owner of the travel
      if (travel.userId !== user.id) {
        throw new CustomForbiddenException('You can only cancel your own travels', ErrorCode.TRAVEL_UNAUTHORIZED);
      }
    }

    // 3. Check if travel is already cancelled
    if (travel.status === 'cancelled') {
      throw new CustomBadRequestException('Travel is already cancelled', ErrorCode.TRAVEL_CANNOT_BE_DELETED);
    }

    // 4. Cancel all active requests (refund paid, release weight, notify requesters)
    if (travel.requests && travel.requests.length > 0) {
      for (const request of travel.requests) {
        await this.requestListingCancellationService.cancelRequestForListingCancellation(request.id, travel.userId);
      }
    }

    // 5. Cancel travel by changing status
    travel.status = 'cancelled';
    if (user && user.id) {
      travel.updatedBy = user.id;
    }

    try {
      const cancelledTravel = await this.travelRepository.save(travel);

      // 7. Clear cache
      await this.clearTravelListCache();

      // Emit event for websocket/email listeners
      try {
        const owner = user ?? (await this.userService.findOne({ id: cancelledTravel.userId }));
        if (owner) {
          const travelWithRelations = await this.travelRepository.findOne({
            where: { id: cancelledTravel.id },
            relations: ['departureAirport', 'arrivalAirport', 'currency'],
          });
          this.userEventService.emitTravelCancelled(owner, travelWithRelations || cancelledTravel);
        }
      } catch {
        // Best-effort: cancellation event should not block the request
      }

      return cancelledTravel;
    } catch (error) {
      throw new CustomBadRequestException(`Failed to cancel travel: ${error.message}`, ErrorCode.TRAVEL_CANNOT_BE_DELETED);
    }
  }

  async findOne(options: any): Promise<TravelEntity | null> {
    return await this.travelRepository.findOne(options);
  }

  async save(travel: TravelEntity): Promise<TravelEntity> {
    return await this.travelRepository.save(travel);
  }



  // Add this method to clear travel list cache
  private async clearTravelListCache(): Promise<void> {
    // Clear all travel list cache keys
    for (const cacheKey of this.travelListCacheKeys) {
      await this.cacheManager.del(cacheKey);
    }
    this.travelListCacheKeys.clear();
  }


  async getTravelDetail(id: number): Promise<TravelDetailResponseDto> {

    const travel = await this.travelRepository.findOne({
      where: { id },
      relations: ['departureAirport', 'arrivalAirport', 'airline', 'images', 'user', 'currency', 'requests'],
    });
    if (!travel) {
      throw new CustomNotFoundException(`travel with ${id} not found`, ErrorCode.TRAVEL_NOT_FOUND);
    }

    // Fetch the 3 most recent reviews received by the travel's user
    const reviews = await this.reviewRepository.find({
      where: { revieweeId: travel.userId },
      relations: ['reviewer', 'reviewee'],
      order: { createdAt: 'DESC' },
      take: 3,
    });

    const response = this.travelMapper.toDetailResponseDto(travel, reviews);
    return response;
  }

  async updateTravel(id: number, updateTravelDto: UpdateTravelDto, user: UserEntity): Promise<TravelEntity> {
    // 1. Check if user account is verified
   /*  if (!user.isVerified) {
      throw new CustomBadRequestException('Your account is not verified', ErrorCode.USER_NOT_VERIFIED);
    } */

    // 2. Find the travel with all necessary relations
    const travel = await this.travelRepository.findOne({
      where: { id },
      relations: ['requests', 'requests.currentStatus', 'requests.transactions'],
    });

    if (!travel) {
      throw new CustomNotFoundException(`Travel with id ${id} not found`, ErrorCode.TRAVEL_NOT_FOUND);
    }

    // 3. Check if user is the owner of the travel
    if (travel.userId !== user.id) {
      throw new CustomForbiddenException('You can only update your own travels', ErrorCode.TRAVEL_UNAUTHORIZED);
    }

    // 4. Check if travel status is 'active'
    if (travel.status !== 'active') {
      throw new CustomBadRequestException(`Cannot update travel with status '${travel.status}'. Only active travels can be updated.`, ErrorCode.TRAVEL_CANNOT_BE_UPDATED);
    }

    // 5. Check for requests with blocking statuses (ACCEPTED, COMPLETED, DELIVERED)
    const blockingStatuses = ['ACCEPTED', 'COMPLETED', 'DELIVERED'];

    if (travel.requests && travel.requests.length > 0) {
      for (const request of travel.requests) {
        if (!request.currentStatus) continue;

        const currentStatus = request.currentStatus.status;

        if (blockingStatuses.includes(currentStatus)) {
          throw new CustomBadRequestException(
            `Cannot update travel because it has a request with status '${currentStatus}'. Travels with accepted, completed, or delivered requests cannot be updated.`,
            ErrorCode.TRAVEL_CANNOT_BE_UPDATED
          );
        }
      }
    }

    // 6. Check for transactions with blocking statuses (paid, refunded)
    if (travel.requests && travel.requests.length > 0) {
      for (const request of travel.requests) {
        if (request.transactions && request.transactions.length > 0) {
          for (const transaction of request.transactions) {
            if (transaction.status === 'paid' || transaction.status === 'refunded') {
              throw new CustomBadRequestException(
                `Cannot update travel because it has a transaction with status '${transaction.status}'. Travels with paid or refunded transactions cannot be updated.`,
                ErrorCode.TRAVEL_CANNOT_BE_UPDATED
              );
            }
          }
        }
      }
    }

    // 7. Validate departure date is today or in the future (ignore time part)
    if (updateTravelDto.departureDatetime) {
      const newDepartureDate = new Date(updateTravelDto.departureDatetime);
      const newDepartureDateOnly = new Date(
        newDepartureDate.getFullYear(),
        newDepartureDate.getMonth(),
        newDepartureDate.getDate(),
      );
      const now = new Date();
      const currentDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (newDepartureDateOnly < currentDateOnly) {
        throw new CustomBadRequestException('Departure datetime must be in the future', ErrorCode.VALIDATION_ERROR);
      }
    }

    const effectiveFlightNumber = updateTravelDto.flightNumber ?? travel.flightNumber;
    const effectiveDepartureAirportId =
      updateTravelDto.departureAirportId ?? travel.departureAirportId;
    const effectiveArrivalAirportId =
      updateTravelDto.arrivalAirportId ?? travel.arrivalAirportId;
    const effectiveDepartureDatetime = updateTravelDto.departureDatetime
      ? new Date(updateTravelDto.departureDatetime)
      : travel.departureDatetime;

    if (effectiveDepartureAirportId === effectiveArrivalAirportId) {
      throw new CustomBadRequestException(
        'Departure and arrival airports cannot be the same',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 8. Check for duplicate active travels on the same trip instance (flight + date, or route + date)
    const flightOrDateChanged =
      updateTravelDto.flightNumber !== undefined ||
      updateTravelDto.departureDatetime !== undefined;
    const routeOrDateChanged =
      updateTravelDto.departureAirportId !== undefined ||
      updateTravelDto.arrivalAirportId !== undefined ||
      updateTravelDto.departureDatetime !== undefined;

    if (flightOrDateChanged) {
      const existingTravelByFlight = await this.findActiveTravelDuplicateByFlight({
        userId: user.id,
        flightNumber: effectiveFlightNumber,
        departureDatetime: effectiveDepartureDatetime,
        excludeTravelId: id,
      });
      if (existingTravelByFlight) {
        throw new CustomBadRequestException(
          'You have already published an active travel with the same flight number on this departure date',
          ErrorCode.TRAVEL_ALREADY_EXISTS,
        );
      }
    }

    if (routeOrDateChanged) {
      const existingTravelByRoute = await this.findActiveTravelDuplicateByRoute({
        userId: user.id,
        departureAirportId: effectiveDepartureAirportId,
        arrivalAirportId: effectiveArrivalAirportId,
        departureDatetime: effectiveDepartureDatetime,
        excludeTravelId: id,
      });
      if (existingTravelByRoute) {
        throw new CustomBadRequestException(
          'You have already published an active travel on the same route on this departure date',
          ErrorCode.TRAVEL_ALREADY_EXISTS,
        );
      }
    }

    // 9. Validate weight constraints
    if (updateTravelDto.totalWeightAllowance !== undefined) {
      // Calculate allocated weight from accepted requests
      let allocatedWeight = 0;
      if (travel.requests && travel.requests.length > 0) {
        for (const request of travel.requests) {
          if (!request.currentStatus) continue;
          
          if (request.currentStatus.status === 'ACCEPTED' && request.weight) {
            allocatedWeight += request.weight;
          }
        }
      }

      // New weightAvailable should be totalWeightAllowance - allocatedWeight
      const newWeightAvailable = updateTravelDto.totalWeightAllowance - allocatedWeight;
      
      if (newWeightAvailable < 0) {
        throw new CustomBadRequestException(
          `Cannot set totalWeightAllowance to ${updateTravelDto.totalWeightAllowance}kg. There are ${allocatedWeight}kg already allocated to accepted requests.`,
          ErrorCode.TRAVEL_CANNOT_BE_UPDATED
        );
      }

      // Update weightAvailable accordingly
      updateTravelDto['weightAvailable'] = newWeightAvailable;
    }

    // 10. Handle isSharedWeight change
    if (updateTravelDto.isSharedWeight !== undefined && updateTravelDto.isSharedWeight !== travel.isSharedWeight) {
      // If changing from shared to non-shared, check if there are multiple requests
      if (!updateTravelDto.isSharedWeight && travel.requests && travel.requests.length > 1) {
        throw new CustomBadRequestException(
          'Cannot change to non-shared weight. This travel already has multiple requests. Only one request is allowed for non-shared weight travels.',
          ErrorCode.TRAVEL_CANNOT_BE_UPDATED
        );
      }
    }

    // 11. Update airline if flight number changed
    if (updateTravelDto.flightNumber && updateTravelDto.flightNumber !== travel.flightNumber) {
      const airline = await this.airlineService.findByFlightNumber(updateTravelDto.flightNumber);
      const airlineId = airline?.id || undefined;
      updateTravelDto['airlineId'] = airlineId;
    }

    // 12. Prepare update data (exclude userId and status)
    const updateData: any = {};
    const allowedFields = [
      'description', 'flightNumber', 'isSharedWeight', 'isInstant', 'isAllowExtraWeight',
      'punctualityLevel', 'feeForGloomy', 'departureAirportId', 'arrivalAirportId',
      'departureDatetime', 'pricePerKg', 'currencyId', 'totalWeightAllowance', 
      'weightAvailable', 'airlineId'
    ];

    for (const field of allowedFields) {
      if (updateTravelDto[field] !== undefined) {
        if (field === 'departureDatetime') {
          const dt = new Date(updateTravelDto[field]);
          updateData[field] = dt;
          // Write both fields during migration
          (updateData as any).travelDate = dt;
        } else {
          updateData[field] = updateTravelDto[field];
        }
      }
    }

    // 13. Update the travel
    Object.assign(travel, updateData);
    travel.updatedBy = user.id;

    try {
      const updatedTravel = await this.travelRepository.save(travel);

      // 14. Clear cache
      await this.clearTravelListCache();

      // Emit event for websocket/email listeners
      // Load relations if needed by listeners (best-effort)
      try {
        const travelWithRelations = await this.travelRepository.findOne({
          where: { id: updatedTravel.id },
          relations: ['departureAirport', 'arrivalAirport', 'currency'],
        });
        this.userEventService.emitTravelUpdated(user, travelWithRelations || updatedTravel);
      } catch {
        this.userEventService.emitTravelUpdated(user, updatedTravel);
      }

      return updatedTravel;
    } catch (error) {
      // Handle foreign key constraint errors
      if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) {
        if (error.sqlMessage.includes('departureAirportId')) {
          throw new CustomBadRequestException(`Departure airport with ID ${updateTravelDto.departureAirportId} does not exist`, ErrorCode.VALIDATION_ERROR);
        } else if (error.sqlMessage.includes('arrivalAirportId')) {
          throw new CustomBadRequestException(`Arrival airport with ID ${updateTravelDto.arrivalAirportId} does not exist`, ErrorCode.VALIDATION_ERROR);
        } else if (error.sqlMessage.includes('currencyId')) {
          throw new CustomBadRequestException(`Currency with ID ${updateTravelDto.currencyId} does not exist`, ErrorCode.VALIDATION_ERROR);
        } else {
          throw new CustomBadRequestException('Invalid reference. Please check airport or currency IDs', ErrorCode.VALIDATION_ERROR);
        }
      }
      
      throw new CustomBadRequestException(`Failed to update travel: ${error.message}`, ErrorCode.INTERNAL_ERROR);
    }
  }

  private async findActiveTravelDuplicateByFlight(params: {
    userId: number;
    flightNumber: string;
    departureDatetime: Date;
    excludeTravelId?: number;
  }): Promise<TravelEntity | null> {
    const queryBuilder = this.travelRepository
      .createQueryBuilder('travel')
      .where('travel.userId = :userId', { userId: params.userId })
      .andWhere('travel.flightNumber = :flightNumber', {
        flightNumber: params.flightNumber.trim(),
      })
      .andWhere('travel.status = :status', { status: 'active' })
      .andWhere('DATE(travel.departureDatetime) = DATE(:departureDate)', {
        departureDate: params.departureDatetime,
      });

    if (params.excludeTravelId !== undefined) {
      queryBuilder.andWhere('travel.id != :excludeTravelId', {
        excludeTravelId: params.excludeTravelId,
      });
    }

    return queryBuilder.getOne();
  }

  private async findActiveTravelDuplicateByRoute(params: {
    userId: number;
    departureAirportId: number;
    arrivalAirportId: number;
    departureDatetime: Date;
    excludeTravelId?: number;
  }): Promise<TravelEntity | null> {
    const queryBuilder = this.travelRepository
      .createQueryBuilder('travel')
      .where('travel.userId = :userId', { userId: params.userId })
      .andWhere('travel.departureAirportId = :departureAirportId', {
        departureAirportId: params.departureAirportId,
      })
      .andWhere('travel.arrivalAirportId = :arrivalAirportId', {
        arrivalAirportId: params.arrivalAirportId,
      })
      .andWhere('travel.status = :status', { status: 'active' })
      .andWhere('DATE(travel.departureDatetime) = DATE(:departureDate)', {
        departureDate: params.departureDatetime,
      });

    if (params.excludeTravelId !== undefined) {
      queryBuilder.andWhere('travel.id != :excludeTravelId', {
        excludeTravelId: params.excludeTravelId,
      });
    }

    return queryBuilder.getOne();
  }

  private buildRequestCountMap(rawRows: Record<string, unknown>[]): Map<number, number> {
    const requestCountByTravelId = new Map<number, number>();

    for (const row of rawRows) {
      const travelId = Number(row.travel_id);
      if (!travelId || requestCountByTravelId.has(travelId)) {
        continue;
      }

      const rawCount = row.requestCount ?? row.travel_requestCount ?? '0';
      requestCountByTravelId.set(travelId, parseInt(String(rawCount), 10) || 0);
    }

    return requestCountByTravelId;
  }

  private isTravelEditable(travel: TravelEntity, requestCount: number): boolean {
    return travel.status === 'active' && requestCount === 0;
  }
}