import { BadRequestException, Inject, Injectable, NotAcceptableException, NotFoundException } from '@nestjs/common';
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
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { FilePurpose } from 'src/uploaded-file/uploaded-file-purpose.enum';
import { UserEventsService } from 'src/events/user-events.service';
import { AirlineService } from 'src/airline/airline.service';
import { CurrencyService } from 'src/currency/currency.service';
import { TravelMapper } from './travel.mapper';
import { ReviewService } from 'src/review/review.service';
import { BookmarkService } from 'src/bookmark/bookmark.service';
import { TravelDetailResponseDto } from './dto/travel-detail.response.dto';
import { CustomNotFoundException, CustomBadRequestException, CustomForbiddenException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { ReviewEntity } from 'src/review/review.entity';
import { RequestEntity } from 'src/request/request.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { RequestStatusService } from 'src/request-status/request-status.service';
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

  async getAllTravels(query: FindTravelsQueryDto): Promise<PaginatedResponse<TravelEntity>> {
    //generate cache key
    const cacheKey = this.generateTravelsListCacheKey(query);
    //add cache key to memory
    this.travelListCacheKeys.add(cacheKey)

    //get data from cache
    const getCachedData = await this.cacheManager.get<PaginatedResponse<TravelEntity>>(cacheKey);
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
      queryBuilder.andWhere('DATE(travel.departureDatetime) = DATE(:departureDate)', { departureDate });
      console.log('🔍 Debug - Added departureDate filter:', departureDate);
    }

    // Apply sorting
    const [sortField, sortDirection] = orderBy.split(':');
    const validSortFields = ['createdAt', 'departureDatetime', 'pricePerKg', 'weightAvailable'];
    const validSortDirections = ['asc', 'desc'];

    if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      queryBuilder.orderBy(`travel.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
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
      .leftJoinAndSelect('travel.images', 'images');

    const items = await queryBuilder.getMany();
    console.log('🔍 Debug - Final items found:', items.length);

    const totalPages = Math.ceil(totalItems / limit);

    const responseResult = {
      items,
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
    if (!user.isVerified) {
      throw new BadRequestException('Your account is not verified')
    }

    // Check if departure and arrival airports are the same
    if (createTravelDto.departureAirportId === createTravelDto.arrivalAirportId) {
      throw new BadRequestException('Departure and arrival airports cannot be the same')
    }

    //check if the user has already published a travel that is not expired with the same flight number
    const existingTravel1 = await this.travelRepository.findOne({
      where: { flightNumber: createTravelDto.flightNumber, userId:user.id, status:'active' }
    })
    if (existingTravel1) {
      throw new BadRequestException('You have already published a travel with the same flight number')
    } 

    //check if the user has already published a travel that is not expired with the same departure and arrival airports
    const existingTravel2 = await this.travelRepository.findOne({
      where: { departureAirportId: createTravelDto.departureAirportId, arrivalAirportId: createTravelDto.arrivalAirportId, userId:user.id, status:'active' }
    })
    if (existingTravel2) {
      throw new BadRequestException('You have already published a travel with the same departure and arrival airports')
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
      feeForLateComer: createTravelDto.feeForLateComer,
      feeForGloomy: createTravelDto.feeForGloomy,
      departureAirportId: createTravelDto.departureAirportId,
      arrivalAirportId: createTravelDto.arrivalAirportId,
      departureDatetime: new Date(createTravelDto.departureDatetime),
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
                throw new BadRequestException(`Departure airport with ID ${createTravelDto.departureAirportId} does not exist`);
            } else if (error.sqlMessage.includes('arrivalAirportId')) {
                throw new BadRequestException(`Arrival airport with ID ${createTravelDto.arrivalAirportId} does not exist`);
            } else {
                throw new BadRequestException('Invalid airport reference. Please check airport IDs');
            }
        }
        
        // Handle other database errors
        if (error.code === 'ER_DUP_ENTRY') {
            throw new BadRequestException('A demand with this flight number already exists');
        }
        
        // Handle image upload errors
        if (error.message && error.message.includes('Failed to upload images')) {
            throw error; // Re-throw image upload errors as they already have proper messages
        }
      // If image upload fails, delete the created travel
      await this.travelRepository.remove(savedTravel);
      throw new BadRequestException(`Failed to upload images: ${error.message}`);
    }
  }

  async softDeleteTravel(id: number, user?: UserEntity): Promise<TravelEntity> {
    // 1. Find the travel with all necessary relations
    const travel = await this.travelRepository.findOne({
      where: { id },
      relations: ['requests', 'requests.currentStatus', 'requests.transactions'],
    });

    if (!travel) {
      throw new CustomNotFoundException(`Travel with id ${id} not found`, ErrorCode.TRAVEL_NOT_FOUND);
    }

    // 2. Check if user is provided and verify ownership (if user is provided)
    if (user) {
      // Check if user account is verified
      if (!user.isVerified) {
        throw new CustomBadRequestException('Your account is not verified', ErrorCode.USER_NOT_VERIFIED);
      }

      // Check if user is the owner of the travel
      if (travel.userId !== user.id) {
        throw new CustomForbiddenException('You can only delete your own travels', ErrorCode.TRAVEL_UNAUTHORIZED);
      }
    }

    // 3. Check if travel is already cancelled
    if (travel.status === 'cancelled') {
      throw new CustomBadRequestException('Travel is already cancelled', ErrorCode.TRAVEL_ALREADY_CANCELLED);
    }

    // 4. Check for requests with blocking statuses (ACCEPTED, COMPLETED, DELIVERED, NEGOTIATING)
    const blockingStatuses = ['ACCEPTED', 'COMPLETED', 'DELIVERED', 'NEGOTIATING'];

    if (travel.requests && travel.requests.length > 0) {
      for (const request of travel.requests) {
        if (!request.currentStatus) continue;

        const currentStatus = request.currentStatus.status;

        if (blockingStatuses.includes(currentStatus)) {
          throw new CustomBadRequestException(
            `Cannot delete travel because it has a request with status '${currentStatus}'. Travels with accepted, completed, delivered, or negotiating requests cannot be deleted.`,
            ErrorCode.TRAVEL_CANNOT_BE_DELETED
          );
        }
      }
    }

    // 5. Check for transactions with blocking statuses (paid, refunded)
    if (travel.requests && travel.requests.length > 0) {
      for (const request of travel.requests) {
        if (request.transactions && request.transactions.length > 0) {
          for (const transaction of request.transactions) {
            if (transaction.status === 'paid' || transaction.status === 'refunded') {
              throw new CustomBadRequestException(
                `Cannot delete travel because it has a transaction with status '${transaction.status}'. Travels with paid or refunded transactions cannot be deleted.`,
                ErrorCode.TRAVEL_CANNOT_BE_DELETED
              );
            }
          }
        }
      }
    }

    // 6. Soft-delete by changing status
    travel.status = 'cancelled';
    if (user && user.id) {
      travel.updatedBy = user.id;
    }

    try {
      const deletedTravel = await this.travelRepository.save(travel);

      // 7. Clear cache
      await this.clearTravelListCache();

      return deletedTravel;
    } catch (error) {
      throw new CustomBadRequestException(`Failed to delete travel: ${error.message}`, ErrorCode.INTERNAL_ERROR);
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
    if (!user.isVerified) {
      throw new CustomBadRequestException('Your account is not verified', ErrorCode.USER_NOT_VERIFIED);
    }

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

    // 7. Validate departure datetime is in the future (if being updated)
    if (updateTravelDto.departureDatetime) {
      const newDepartureDate = new Date(updateTravelDto.departureDatetime);
      if (newDepartureDate <= new Date()) {
        throw new CustomBadRequestException('Departure datetime must be in the future', ErrorCode.VALIDATION_ERROR);
      }
    }

    // 8. Check for duplicate active travels (if flight number or route is being updated)
    if (updateTravelDto.flightNumber) {
      const existingTravel = await this.travelRepository.findOne({
        where: { 
          flightNumber: updateTravelDto.flightNumber, 
          userId: user.id, 
          status: 'active'
        }
      });
      if (existingTravel && existingTravel.id !== id) {
        throw new CustomBadRequestException('You have already published an active travel with the same flight number', ErrorCode.TRAVEL_ALREADY_EXISTS);
      }
    }

    if (updateTravelDto.departureAirportId || updateTravelDto.arrivalAirportId) {
      const departureAirportId = updateTravelDto.departureAirportId || travel.departureAirportId;
      const arrivalAirportId = updateTravelDto.arrivalAirportId || travel.arrivalAirportId;
      
      // Check if departure and arrival airports are the same
      if (departureAirportId === arrivalAirportId) {
        throw new CustomBadRequestException('Departure and arrival airports cannot be the same', ErrorCode.VALIDATION_ERROR);
      }
      
      const existingTravel = await this.travelRepository.findOne({
        where: { 
          departureAirportId, 
          arrivalAirportId, 
          userId: user.id, 
          status: 'active'
        }
      });
      if (existingTravel && existingTravel.id !== id) {
        throw new CustomBadRequestException('You have already published an active travel with the same departure and arrival airports', ErrorCode.TRAVEL_ALREADY_EXISTS);
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
      'feeForLateComer', 'feeForGloomy', 'departureAirportId', 'arrivalAirportId',
      'departureDatetime', 'pricePerKg', 'currencyId', 'totalWeightAllowance', 
      'weightAvailable', 'airlineId'
    ];

    for (const field of allowedFields) {
      if (updateTravelDto[field] !== undefined) {
        if (field === 'departureDatetime') {
          updateData[field] = new Date(updateTravelDto[field]);
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
}