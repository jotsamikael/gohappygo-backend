import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/user/user.entity';
import { UserService } from 'src/user/user.service';
import { UpdateReviewDto } from './dto/updateReview.dto';
import { CreateReviewDto } from './dto/createReview.dto';
import { ReviewEntity } from './review.entity';
import { FindReviewsQueryDto } from './dto/findReviewsQuery.dto';
import { UserRole } from 'src/user/user.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { PaginatedReviewsResponseDto, ReviewResponseDto, CreateReviewResponseDto } from './dto/review-response.dto';
import { RequestService } from 'src/request/request.service';
import { CustomNotFoundException, CustomRequestNotCompletedException, CustomRequestNotLinkedToTravelOrDemandException, CustomReviewAlreadyExistsException, CustomUnauthorizedException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { ModerateReviewDto } from './dto/moderateReview.dto';
import { ReviewMapper } from './review.mapper';
import { RequestEntity } from 'src/request/request.entity';


@Injectable()
export class ReviewService {
  // Add these private properties for caching
  private reviewListCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(ReviewEntity) private reviewRepository: Repository<ReviewEntity>,
    @InjectRepository(RequestEntity) private requestRepository: Repository<RequestEntity>,
    private requestService: RequestService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reviewMapper: ReviewMapper
  ) {}

  
  async addReview(user: UserEntity, reviewDto: CreateReviewDto): Promise<CreateReviewResponseDto> {
    // Fetch the request with its relations to get travel/demand and their users
   
    const request = await this.requestService.getRequestById(reviewDto.requestId);
   

    if (!request) {
      throw new CustomNotFoundException(`Request with id ${reviewDto.requestId} not found`, ErrorCode.REQUEST_NOT_FOUND);
    }

    if(request.currentStatus.status !== 'COMPLETED') {
      throw new CustomRequestNotCompletedException('Request is not completed, you can only review completed requests', ErrorCode.REQUEST_NOT_COMPLETED);
    }

    // Determine the reviewee based on the request type and who is reviewing
    let revieweeId: number;
    let reviewee: UserEntity;

    if (request.travelId) {
      // Request is linked to a travel
      // If reviewer is the requester, they review the travel owner
      // If reviewer is the travel owner, they review the requester
      if (user.id === request.requesterId) {
        revieweeId = request.travel.userId;
        reviewee = request.travel.user;
      } else if (user.id === request.travel.userId) {
        revieweeId = request.requesterId;
        reviewee = request.requester;
      } else {
        throw new CustomUnauthorizedException('You are not authorized to review this request', ErrorCode.REQUEST_NOT_LINKED);
      }
    } else if (request.demandId) {
      // Request is linked to a demand
      // If reviewer is the requester, they review the demand owner
      // If reviewer is the demand owner, they review the requester
      if (user.id === request.requesterId) {
        revieweeId = request.demand.userId;
        reviewee = request.demand.user;
      } else if (user.id === request.demand.userId) {
        revieweeId = request.requesterId;
        reviewee = request.requester;
      } else {
        throw new CustomUnauthorizedException('You are not authorized to review this request', ErrorCode.REQUEST_NOT_LINKED);
      }
    } else {
      throw new CustomRequestNotLinkedToTravelOrDemandException('Request is not linked to a travel or demand', ErrorCode.REQUEST_NOT_LINKED);
    }

    // Check if user has already reviewed this request
    const existingReview = await this.reviewRepository.findOne({
      where: {
        requestId: reviewDto.requestId,
        reviewerId: user.id
      }
    });

    if (existingReview) {
      throw new CustomReviewAlreadyExistsException('You have already reviewed this request', ErrorCode.REVIEW_ALREADY_EXISTS);
    }

    // Create the review
    const review = this.reviewRepository.create({
      requestId: reviewDto.requestId,
      reviewerId: user.id,
      revieweeId: revieweeId,
      rating: reviewDto.rating,
      comment: reviewDto.comment,
      reviewer: user,
      reviewee: reviewee,
      createdBy: user.id
    });

    const savedReview = await this.reviewRepository.save(review);
    
    // Reload with relations for proper mapping
    const reviewWithRelations = await this.reviewRepository.findOne({
      where: { id: savedReview.id },
      relations: ['reviewer', 'reviewee'],
    });
    
    // Clear cache
    await this.clearReviewListCache();
    
    // Transform to create review response format
    const reviewData = reviewWithRelations || savedReview;
    const reviewerDto = reviewData.reviewer 
      ? this.reviewMapper.mapUserToDto(reviewData.reviewer)
      : null;
    const revieweeDto = reviewData.reviewee 
      ? this.reviewMapper.mapUserToDto(reviewData.reviewee)
      : null;
    
    return {
      message: 'Review created successfully',
      review: {
        id: reviewData.id,
        rating: reviewData.rating,
        comment: reviewData.comment,
        requestId: reviewData.requestId,
        reviewerId: reviewData.reviewerId,
        revieweeId: reviewData.revieweeId,
        createdAt: reviewData.createdAt,
        reviewer: reviewerDto!,
        reviewee: revieweeDto!,
      }
    };
  }
 

    async editReview(reviewId: number, user: UserEntity, updateDto: UpdateReviewDto): Promise<ReviewEntity> {
      const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
    
      if (!review) {
        throw new CustomNotFoundException('Review not found', ErrorCode.REVIEW_NOT_FOUND);
      }
      if (review.reviewerId !== user.id) {
        throw new CustomUnauthorizedException('You can only edit your own reviews', ErrorCode.REVIEW_UNAUTHORIZED);
      }
    
      const now = new Date();
      const createdAt = new Date(review.createdAt);
      const diffMs = now.getTime() - createdAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
      if (diffDays > 1) {
        throw new CustomUnauthorizedException('You can only edit a review within 1 day of submission', ErrorCode.REVIEW_EDIT_TIME_EXPIRED);
      }
    
      // Update fields
      if (updateDto.rating !== undefined) review.rating = updateDto.rating;
      if (updateDto.comment !== undefined) review.comment = updateDto.comment;
    
      const updatedReview = await this.reviewRepository.save(review);
    
    // Clear cache
    await this.clearReviewListCache();
    
    return updatedReview;
    }

  async getAllReviews(query: FindReviewsQueryDto, user: UserEntity): Promise<PaginatedReviewsResponseDto> {
    // Generate cache key
    const cacheKey = this.generateReviewListCacheKey(query, user.id);
    this.reviewListCacheKeys.add(cacheKey);

    // Check cache first
    const cachedData = await this.cacheManager.get<PaginatedReviewsResponseDto>(cacheKey);
    if (cachedData) {
      console.log(`Cache Hit---------> Returning reviews list from Cache ${cacheKey}`);
      return cachedData;
    }

    console.log(`Cache Miss---------> Returning reviews list from database`);

    const {
      page = 1,
      limit = 10,
      id,
      reviewerId,
      revieweeId,
      requestId,
      rating,
      comment,
      createdAt,
      orderBy = 'createdAt:desc',
      asReviewer = false
    } = query;

    const skip = (page - 1) * limit;

    // Build the query with complex logic for user permissions
    const queryBuilder = this.reviewRepository.createQueryBuilder('review')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      .leftJoinAndSelect('review.reviewee', 'reviewee')
      .skip(skip)
      .take(limit);

    // Apply user-specific filtering logic
    const isAdmin = user.role?.code === UserRole.ADMIN;
    const isOperator = user.role?.code === UserRole.OPERATOR;

    if (!isAdmin && !isOperator) {
      if (asReviewer) {
        // Only show reviews where user is the reviewer
        queryBuilder.andWhere('review.reviewerId = :userId', { userId: user.id });
      } else {
        // Default: show reviews where user is reviewer OR reviewee
        queryBuilder.andWhere(
          '(review.reviewerId = :userId OR review.revieweeId = :userId)',
          { userId: user.id }
        );
      }
    } else if (asReviewer) {
      // For admins/operators, if asReviewer is true, filter by current user as reviewer
      queryBuilder.andWhere('review.reviewerId = :userId', { userId: user.id });
    }

    // Apply filters
    if (id) {
      queryBuilder.andWhere('review.id = :id', { id });
    }

    if (reviewerId && (isAdmin || isOperator)) {
      queryBuilder.andWhere('review.reviewerId = :reviewerId', { reviewerId });
    }

    if (revieweeId && (isAdmin || isOperator)) {
      queryBuilder.andWhere('review.revieweeId = :revieweeId', { revieweeId });
    }

    if (requestId) {
      queryBuilder.andWhere('review.requestId = :requestId', { requestId });
    }

    if (rating !== undefined) {
      queryBuilder.andWhere('review.rating = :rating', { rating });
    }

    if (comment) {
      queryBuilder.andWhere('LOWER(review.comment) LIKE LOWER(:comment)', {
        comment: `%${comment}%`
      });
    }

    if (createdAt) {
      queryBuilder.andWhere('DATE(review.createdAt) = DATE(:createdAt)', { createdAt });
    }

    // Apply sorting
    const [sortField, sortDirection] = orderBy.split(':');
    const validSortFields = ['createdAt', 'rating', 'id'];
    const validSortDirections = ['asc', 'desc'];

    if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      queryBuilder.orderBy(`review.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy('review.createdAt', 'DESC'); // default
    }

    // Get the count first
    const totalItems = await queryBuilder.getCount();

    // Get the actual data
    const items = await queryBuilder.getMany();

    // Load requests with travel and demand for each review
    const reviewIds = items.map(review => review.requestId);
    const requests = await this.requestRepository.find({
      where: reviewIds.length > 0 ? reviewIds.map(id => ({ id })) : [],
      relations: ['travel', 'demand', 'currentStatus'],
    });

    // Create a map for quick lookup
    const requestMap = new Map(requests.map(req => [req.id, req]));

    // Attach requests to reviews - preserve the entity object to keep relations
    const reviewsWithRequests = items.map(review => {
      const request = requestMap.get(review.requestId);
      // Don't use spread - directly modify the entity to preserve relations
      const reviewEntity = review as any;
      reviewEntity.request = request || null;
      return reviewEntity;
    });

    // Transform the data using mapper
    const transformedItems = reviewsWithRequests.map(review => this.reviewMapper.toResponseDto(review));

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
  private generateReviewListCacheKey(query: FindReviewsQueryDto, userId: number): string {
    const {
      page = 1,
      limit = 10,
      id,
      reviewerId,
      revieweeId,
      requestId,
      rating,
      comment,
      createdAt,
      orderBy = 'createdAt:desc'
    } = query;

    return `reviews_list_user${userId}_page${page}_limit${limit}_id${id || 'all'}_reviewer${reviewerId || 'all'}_reviewee${revieweeId || 'all'}_request${requestId || 'all'}_rating${rating || 'all'}_comment${comment || 'all'}_date${createdAt || 'all'}_order${orderBy}`;
  }

  // Add cache clearing method
  private async clearReviewListCache(): Promise<void> {
    const cacheKeys = Array.from(this.reviewListCacheKeys);
    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }
    this.reviewListCacheKeys.clear();
  }

  // Transform method

 

    async getReviewById(id: number): Promise<ReviewEntity | null>{
      const review = await this.reviewRepository.findOneBy({id:id});

      if(!review){
        throw new CustomNotFoundException(`No review found with id ${id}`, ErrorCode.REVIEW_NOT_FOUND);
      }
      return review;
    }


    //reviews posted by user
   async getReviewByUser(userId: number): Promise<ReviewEntity[]> {
    return this.reviewRepository.find({
      where: { reviewerId: userId },
      relations: ['reviewee', 'reviewer'], // include user info if needed
      order: { id: 'DESC' }, // or 'createdAt' if you have a timestamp
    });
  }

    //reviews received by posted
    getReviewOfUser(id: number): Promise<ReviewEntity[] | null>{
      return this.reviewRepository.find({
        where: { revieweeId: id },
        relations: ['reviewee', 'reviewer'], // include user info if needed
        order: { id: 'DESC' }, // or 'createdAt' if you have a timestamp
      });
    }

  async moderateReview(
    reviewId: number,
    user: UserEntity,
    moderateDto: ModerateReviewDto
  ): Promise<CreateReviewResponseDto> {
    // Check if user is admin or operator
    const isAdmin = user.role?.code === UserRole.ADMIN;
    const isOperator = user.role?.code === UserRole.OPERATOR;

    if (!isAdmin && !isOperator) {
      throw new CustomUnauthorizedException(
        'Only administrators and operators can moderate reviews',
        ErrorCode.REVIEW_UNAUTHORIZED
      );
    }

    // Fetch the review with relations
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
      relations: ['reviewer', 'reviewee']
    });

    if (!review) {
      throw new CustomNotFoundException(
        'Review not found',
        ErrorCode.REVIEW_NOT_FOUND
      );
    }

    // Update only the comment (admins/operators cannot change ratings)
    review.comment = moderateDto.comment;
    review.updatedBy = user.id; // Track who moderated it

    // Save the moderated review
    const moderatedReview = await this.reviewRepository.save(review);

    // Clear cache
    await this.clearReviewListCache();

    // Return formatted response
    return {
      message: 'Review moderated successfully',
      review: {
        id: moderatedReview.id,
        rating: moderatedReview.rating,
        comment: moderatedReview.comment,
        requestId: moderatedReview.requestId,
        reviewerId: moderatedReview.reviewerId,
        revieweeId: moderatedReview.revieweeId,
        createdAt: moderatedReview.createdAt,
        reviewer: this.reviewMapper.mapUserToDto(review.reviewer),
        reviewee: this.reviewMapper.mapUserToDto(review.reviewee)
      }
    };
  }
}
