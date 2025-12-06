import { BadRequestException, Inject, Injectable, NotAcceptableException, NotFoundException } from '@nestjs/common';
import { DemandEntity } from './demand.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/user/user.entity';
import { CreateDemandDto } from './dto/createDemand.dto';
import { UpdateDemandDto } from './dto/updateDemand.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FindDemandsQueryDto } from './dto/FindDemandsQuery.dto';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { UserRoleEntity } from 'src/role/userRole.entity';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { FilePurpose } from 'src/uploaded-file/uploaded-file-purpose.enum';
import { UserEventsService } from 'src/events/user-events.service';
import { AirlineService } from 'src/airline/airline.service';
import { DemandMapper } from './demand.mapper';
import { DemandDetailResponseDto } from './dto/demand-detail-response.dto';
import { CustomNotFoundException, CustomBadRequestException, CustomForbiddenException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { ReviewEntity } from 'src/review/review.entity';
import { RequestEntity } from 'src/request/request.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { RequestStatusService } from 'src/request-status/request-status.service';

@Injectable()
export class DemandService {
  

      private demandListCacheKeys: Set<string> = new Set();

    constructor(
        @InjectRepository(DemandEntity) private demandRepository: Repository<DemandEntity>,
        @InjectRepository(ReviewEntity) private reviewRepository: Repository<ReviewEntity>,
        @InjectRepository(RequestEntity) private requestRepository: Repository<RequestEntity>,
        @InjectRepository(TransactionEntity) private transactionRepository: Repository<TransactionEntity>,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly fileUploadService: FileUploadService,
        private readonly userEventService: UserEventsService,
        private readonly airlineService: AirlineService,
        private readonly demandMapper: DemandMapper,
        private readonly requestStatusService: RequestStatusService

    ){}


async getDemands(query: FindDemandsQueryDto): Promise<PaginatedResponse<DemandEntity>> {
  
  const cacheKey = this.generateDemandListCacheKey(query);
  this.demandListCacheKeys.add(cacheKey);

  // Check cache first
  const cachedData = await this.cacheManager.get<PaginatedResponse<DemandEntity>>(cacheKey);
  if (cachedData) {
      console.log(`Cache Hit---------> Returning demands list from Cache ${cacheKey}`);
      return cachedData;
  }

  console.log(`Cache Miss---------> Returning demands list from database`);

  const { 
      page = 1, 
      limit = 10, 
      description, 
      flightNumber,
      airlineId,
      departureAirportId, 
      arrivalAirportId, 
      userId, 
      status, 
      travelDate, 
      packageKind,
      orderBy = 'createdAt:desc' 
  } = query;

  const skip = (page - 1) * limit;
  
  // Build the query step by step to avoid complex joins that might cause issues
  const queryBuilder = this.demandRepository.createQueryBuilder('demand')
      .skip(skip)
      .take(limit);

  // Apply filters
  if (description) {
      queryBuilder.andWhere('LOWER(demand.description) LIKE LOWER(:description)', { description: `%${description}%` });
  }

  if (flightNumber) {
      queryBuilder.andWhere('demand.flightNumber = :flightNumber', { flightNumber });
      console.log('Added flightNumber filter:', flightNumber);
  }

  if (airlineId) {
      queryBuilder.andWhere('demand.airlineId = :airlineId', { airlineId });
      console.log('Added airlineId filter:', airlineId);
  }

  if (departureAirportId) {
      queryBuilder.andWhere('demand.departureAirportId = :departureAirportId', { departureAirportId });
      console.log('Added departureAirportId filter:', departureAirportId);
  }

  if (arrivalAirportId) {
      queryBuilder.andWhere('demand.arrivalAirportId = :arrivalAirportId', { arrivalAirportId });
      console.log('Added arrivalAirportId filter:', arrivalAirportId);
  }

  if (userId) {
      queryBuilder.andWhere('demand.userId = :userId', { userId });
      console.log('Added userId filter:', userId);
  }

  if (status) {
      queryBuilder.andWhere('demand.status = :status', { status });
      console.log('Added status filter:', status);
  }

  if (travelDate) {
      queryBuilder.andWhere('DATE(demand.travelDate) = DATE(:travelDate)', { travelDate });
      console.log('Added travelDate filter:', travelDate);
  }

  if (packageKind) {
      queryBuilder.andWhere('demand.packageKind = :packageKind', { packageKind });
      console.log('Added packageKind filter:', packageKind);
  }

  // Apply sorting
  const [sortField, sortDirection] = orderBy.split(':');
  const validSortFields = ['createdAt', 'travelDate', 'pricePerKg', 'weight'];
  const validSortDirections = ['asc', 'desc'];
  
  if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      queryBuilder.orderBy(`demand.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
      console.log('Added sorting:', `${sortField}:${sortDirection}`);
  } else {
      queryBuilder.orderBy('demand.createdAt', 'DESC'); // default
      console.log('Added default sorting: createdAt:DESC');
  }

  // Get the count first (without joins to avoid complex queries)
  // Log query details to verify filters are applied
  if (airlineId) {
    console.log('🔍 Demand COUNT Query - Filtering by airlineId:', airlineId);
  }
  console.log('🔍 Demand COUNT Query SQL:', queryBuilder.getSql());
  console.log('🔍 Demand COUNT Query Params:', queryBuilder.getParameters());
  
  let totalItems: number;
  try {
    totalItems = await queryBuilder.getCount();
    console.log('🔍 Demand COUNT Result:', totalItems);
  } catch (error) {
    console.error('❌ Error executing demand COUNT query:', error);
    throw error;
  }
  
  // Now add the joins for the actual data
  queryBuilder
      .leftJoinAndSelect('demand.user', 'user')
      .leftJoinAndSelect('demand.departureAirport', 'departureAirport')
      .leftJoinAndSelect('demand.arrivalAirport', 'arrivalAirport')
      .leftJoinAndSelect('demand.airline', 'airline')
      .leftJoinAndSelect('demand.images', 'images');

  const items = await queryBuilder.getMany();
  
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
  };

  await this.cacheManager.set(cacheKey, responseResult, 30000);
  return responseResult;
}

  
async publishDemand(
    user: UserEntity, 
    createDemandDto: CreateDemandDto, 
    image1: Express.Multer.File, 
    image2: Express.Multer.File,
    image3: Express.Multer.File  // Add third parameter
): Promise<DemandEntity> {
      //check if user account is verified
      if(!user.isVerified){
        throw new BadRequestException('Your account is not verified')
      }
      //check if the user has a demand no yet expired with the same flight number
      const existingDemand1 = await this.demandRepository.findOne({
        where:{flightNumber:createDemandDto.flightNumber, userId:user.id, status:'active'}
      })
      if(existingDemand1){
        throw new BadRequestException('You have already published a demand with the same flight number')
      }
      //check if the user has a demand no yet expired with the same departure and arrival airports
      const existingDemand2 = await this.demandRepository.findOne({
        where:{departureAirportId:createDemandDto.departureAirportId, arrivalAirportId:createDemandDto.arrivalAirportId, userId:user.id, status:'active'}
      })
      if(existingDemand2){
        throw new BadRequestException('You have already published a demand with the same departure and arrival airports')
      }

        // Get airline from flight number
    const airline = await this.airlineService.findByFlightNumber(createDemandDto.flightNumber);
    const airlineId = airline?.id || undefined;
      

      // Create the demand first
      const newDemand = await this.demandRepository.create({
          userId: user.id,
          description: createDemandDto.description,
          flightNumber: createDemandDto.flightNumber,
          departureAirportId: createDemandDto.departureAirportId,
          arrivalAirportId: createDemandDto.arrivalAirportId,
          currencyId: createDemandDto.currencyId,
          travelDate: createDemandDto.travelDate,
          weight: createDemandDto.weight,
          pricePerKg: createDemandDto.pricePerKg,
          packageKind: createDemandDto.packageKind,
          airlineId: airlineId,
          createdBy: user.id,
          user: user
      });

      try {
          const savedDemand = await this.demandRepository.save(newDemand);

          // Upload all three images with demand association
          await this.fileUploadService.uploadMultipleFiles(
              [image1, image2, image3],  // Add third image
              [FilePurpose.DEMAND_IMAGE_1, FilePurpose.DEMAND_IMAGE_2, FilePurpose.DEMAND_IMAGE_3],  // Add third purpose
              user,
              undefined, // travel
              savedDemand // demand
          );

          // Clear cache for demand lists
          await this.clearDemandListCache();

          // Fetch the demand with populated relations for the email
          const demandWithRelations = await this.demandRepository.findOne({
            where: { id: savedDemand.id },
            relations: ['departureAirport', 'arrivalAirport', 'currency']
          });

          // emit demand created event with populated data
          this.userEventService.emitDemandPublished(user, demandWithRelations || savedDemand);

          return savedDemand;
      } catch (error) {
          // Handle foreign key constraint errors
          if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) {
              if (error.sqlMessage.includes('departureAirportId')) {
                  throw new BadRequestException(`Departure airport with ID ${createDemandDto.departureAirportId} does not exist`);
              } else if (error.sqlMessage.includes('arrivalAirportId')) {
                  throw new BadRequestException(`Arrival airport with ID ${createDemandDto.arrivalAirportId} does not exist`);
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
          
          // Generic database error
          throw new BadRequestException(`Failed to create demand: ${error.message || 'Unknown database error'}`);
      }
  }


  async updateDemand(id: number, updateDemandDto: UpdateDemandDto, user: UserEntity): Promise<DemandEntity> {
    // 1. Check if user account is verified
    if (!user.isVerified) {
      throw new CustomBadRequestException('Your account is not verified', ErrorCode.USER_NOT_VERIFIED);
    }

    // 2. Find the demand with all necessary relations
    const demand = await this.demandRepository.findOne({
      where: { id },
      relations: ['requests', 'requests.currentStatus', 'requests.transactions'],
    });

    if (!demand) {
      throw new CustomNotFoundException(`Demand with id ${id} not found`, ErrorCode.DEMAND_NOT_FOUND);
    }

    // 3. Check if user is the owner of the demand
    if (demand.userId !== user.id) {
      throw new CustomForbiddenException('You can only update your own demands', ErrorCode.DEMAND_UNAUTHORIZED);
    }

    // 4. Check if demand status is 'active'
    if (demand.status !== 'active') {
      throw new CustomBadRequestException(`Cannot update demand with status '${demand.status}'. Only active demands can be updated.`, ErrorCode.DEMAND_CANNOT_BE_UPDATED);
    }

    // 5. Check for requests with blocking statuses (ACCEPTED, COMPLETED, DELIVERED)
    const blockingStatuses = ['ACCEPTED', 'COMPLETED', 'DELIVERED'];

    if (demand.requests && demand.requests.length > 0) {
      for (const request of demand.requests) {
        if (!request.currentStatus) continue;

        const currentStatus = request.currentStatus.status;

        if (blockingStatuses.includes(currentStatus)) {
          throw new CustomBadRequestException(
            `Cannot update demand because it has a request with status '${currentStatus}'. Demands with accepted, completed, or delivered requests cannot be updated.`,
            ErrorCode.DEMAND_CANNOT_BE_UPDATED
          );
        }
      }
    }

    // 6. Check for transactions with blocking statuses (paid, refunded)
    if (demand.requests && demand.requests.length > 0) {
      for (const request of demand.requests) {
        if (request.transactions && request.transactions.length > 0) {
          for (const transaction of request.transactions) {
            if (transaction.status === 'paid' || transaction.status === 'refunded') {
              throw new CustomBadRequestException(
                `Cannot update demand because it has a transaction with status '${transaction.status}'. Demands with paid or refunded transactions cannot be updated.`,
                ErrorCode.DEMAND_CANNOT_BE_UPDATED
              );
            }
          }
        }
      }
    }

    // 7. Validate travel date is in the future (if being updated)
    if (updateDemandDto.travelDate) {
      const newTravelDate = new Date(updateDemandDto.travelDate);
      if (newTravelDate <= new Date()) {
        throw new CustomBadRequestException('Travel date must be in the future', ErrorCode.VALIDATION_ERROR);
      }
    }

    // 8. Check for duplicate active demands (if flight number or route is being updated)
    if (updateDemandDto.flightNumber) {
      const existingDemand = await this.demandRepository.findOne({
        where: { 
          flightNumber: updateDemandDto.flightNumber, 
          userId: user.id, 
          status: 'active'
        }
      });
      if (existingDemand && existingDemand.id !== id) {
        throw new CustomBadRequestException('You have already published an active demand with the same flight number', ErrorCode.DEMAND_ALREADY_EXISTS);
      }
    }

    if (updateDemandDto.departureAirportId || updateDemandDto.arrivalAirportId) {
      const departureAirportId = updateDemandDto.departureAirportId || demand.departureAirportId;
      const arrivalAirportId = updateDemandDto.arrivalAirportId || demand.arrivalAirportId;
      
      const existingDemand = await this.demandRepository.findOne({
        where: { 
          departureAirportId, 
          arrivalAirportId, 
          userId: user.id, 
          status: 'active'
        }
      });
      if (existingDemand && existingDemand.id !== id) {
        throw new CustomBadRequestException('You have already published an active demand with the same departure and arrival airports', ErrorCode.DEMAND_ALREADY_EXISTS);
      }
    }

    // 9. Update airline if flight number changed
    if (updateDemandDto.flightNumber && updateDemandDto.flightNumber !== demand.flightNumber) {
      const airline = await this.airlineService.findByFlightNumber(updateDemandDto.flightNumber);
      const airlineId = airline?.id || undefined;
      updateDemandDto['airlineId'] = airlineId;
    }

    // 10. Prepare update data (exclude userId and status)
    const updateData: any = {};
    const allowedFields = [
      'description', 'flightNumber', 'departureAirportId', 'arrivalAirportId',
      'travelDate', 'weight', 'pricePerKg', 'currencyId', 'packageKind', 'airlineId'
    ];

    for (const field of allowedFields) {
      if (updateDemandDto[field] !== undefined) {
        if (field === 'travelDate') {
          updateData[field] = new Date(updateDemandDto[field]);
        } else {
          updateData[field] = updateDemandDto[field];
        }
      }
    }

    // 11. Update the demand
    Object.assign(demand, updateData);
    demand.updatedBy = user.id;

    try {
      const updatedDemand = await this.demandRepository.save(demand);

      // 12. Clear cache
      await this.clearDemandListCache();

      return updatedDemand;
    } catch (error) {
      // Handle foreign key constraint errors
      if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) {
        if (error.sqlMessage.includes('departureAirportId')) {
          throw new CustomBadRequestException(`Departure airport with ID ${updateDemandDto.departureAirportId} does not exist`, ErrorCode.VALIDATION_ERROR);
        } else if (error.sqlMessage.includes('arrivalAirportId')) {
          throw new CustomBadRequestException(`Arrival airport with ID ${updateDemandDto.arrivalAirportId} does not exist`, ErrorCode.VALIDATION_ERROR);
        } else if (error.sqlMessage.includes('currencyId')) {
          throw new CustomBadRequestException(`Currency with ID ${updateDemandDto.currencyId} does not exist`, ErrorCode.VALIDATION_ERROR);
        } else {
          throw new CustomBadRequestException('Invalid reference. Please check airport or currency IDs', ErrorCode.VALIDATION_ERROR);
        }
      }
      
      throw new CustomBadRequestException(`Failed to update demand: ${error.message}`, ErrorCode.INTERNAL_ERROR);
    }
  }

async softDeleteDemandByUser(id: number, user?: UserEntity): Promise<DemandEntity> {
  // 1. Find the demand with all necessary relations
  const demand = await this.demandRepository.findOne({
    where: { id },
    relations: ['requests', 'requests.currentStatus', 'requests.transactions'],
  });

  if (!demand) {
    throw new CustomNotFoundException(`Demand with id ${id} not found`, ErrorCode.DEMAND_NOT_FOUND);
  }

  // 2. Check if user is provided and verify ownership (if user is provided)
  if (user) {
    // Check if user account is verified
    if (!user.isVerified) {
      throw new CustomBadRequestException('Your account is not verified', ErrorCode.USER_NOT_VERIFIED);
    }

    // Check if user is the owner of the demand
    if (demand.userId !== user.id) {
      throw new CustomForbiddenException('You can only delete your own demands', ErrorCode.DEMAND_UNAUTHORIZED);
    }
  }

  // 3. Check if demand is already cancelled
  if (demand.status === 'cancelled') {
    throw new CustomBadRequestException('Demand is already cancelled', ErrorCode.DEMAND_ALREADY_CANCELLED);
  }

  // 4. Check for requests with blocking statuses (ACCEPTED, COMPLETED, DELIVERED, NEGOTIATING)
  const blockingStatuses = ['ACCEPTED', 'COMPLETED', 'DELIVERED', 'NEGOTIATING'];

  if (demand.requests && demand.requests.length > 0) {
    for (const request of demand.requests) {
      if (!request.currentStatus) continue;

      const currentStatus = request.currentStatus.status;

      if (blockingStatuses.includes(currentStatus)) {
        throw new CustomBadRequestException(
          `Cannot delete demand because it has a request with status '${currentStatus}'. Demands with accepted, completed, delivered, or negotiating requests cannot be deleted.`,
          ErrorCode.DEMAND_CANNOT_BE_DELETED
        );
      }
    }
  }

  // 5. Check for transactions with blocking statuses (paid, refunded)
  if (demand.requests && demand.requests.length > 0) {
    for (const request of demand.requests) {
      if (request.transactions && request.transactions.length > 0) {
        for (const transaction of request.transactions) {
          if (transaction.status === 'paid' || transaction.status === 'refunded') {
            throw new CustomBadRequestException(
              `Cannot delete demand because it has a transaction with status '${transaction.status}'. Demands with paid or refunded transactions cannot be deleted.`,
              ErrorCode.DEMAND_CANNOT_BE_DELETED
            );
          }
        }
      }
    }
  }

  // 6. Soft-delete by changing status
  demand.status = 'cancelled';
  if (user && user.id) {
    demand.updatedBy = user.id;
  }

  try {
    const deletedDemand = await this.demandRepository.save(demand);

    // 7. Clear cache
    await this.clearDemandListCache();

    return deletedDemand;
  } catch (error) {
    throw new CustomBadRequestException(`Failed to delete demand: ${error.message}`, ErrorCode.INTERNAL_ERROR);
  }
}

async getDemandById(id: number): Promise<DemandDetailResponseDto>  {
  const demand = await this.demandRepository.findOne({
    where: { id },
    relations: ['departureAirport', 'arrivalAirport', 'airline', 'images', 'user', 'currency', 'requests'],
  });
  if (!demand) {
    throw new CustomNotFoundException(`demand with ${id} not found`, ErrorCode.DEMAND_NOT_FOUND);
  }

  // Fetch the 3 most recent reviews received by the travel's user
  const reviews = await this.reviewRepository.find({
    where: { revieweeId: demand.userId },
    relations: ['reviewer', 'reviewee'],
    order: { createdAt: 'DESC' },
    take: 3,
  });

  const response = this.demandMapper.toDemandDetailResponse(demand, reviews);
  return response;
}


findOne(arg0: { where: { id: number }; }): Promise<DemandEntity | null> {
  return this.demandRepository.findOne({
    where: arg0.where
  })
}

save(demand: DemandEntity): Promise<DemandEntity> {
  return this.demandRepository.save(demand);
}

private generateDemandListCacheKey(query: FindDemandsQueryDto): string {
  const { 
      page = 1, 
      limit = 10, 
      description, 
      flightNumber,
      airlineId, 
      departureAirportId, 
      arrivalAirportId, 
      userId, 
      status, 
      travelDate, 
      packageKind,
      orderBy = 'createdAt:desc' 
  } = query;
  
  return `demands_list_page${page}_limit${limit}_description${description || 'all'}_flight${flightNumber || 'all'}_airline${airlineId || 'all'}_origin${departureAirportId || 'all'}_dest${arrivalAirportId || 'all'}_user${userId || 'all'}_status${status || 'all'}_date${travelDate || 'all'}_packageKind${packageKind || 'all'}_order${orderBy}`;
}

private async clearDemandListCache(): Promise<void> {
    const cacheKeys = Array.from(this.demandListCacheKeys);
    for (const key of cacheKeys) {
        await this.cacheManager.del(key);
    }
    this.demandListCacheKeys.clear();
}
}


