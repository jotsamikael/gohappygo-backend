import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookmarkEntity, BookmarkType } from './entities/bookmark.entity';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { UpdateBookmarkDto } from './dto/update-bookmark.dto';
import { FindBookmarksQueryDto } from './dto/find-bookmarks-query.dto';
import { BookmarkMapper } from './bookmark.mapper';
import { BookmarkItemResponseDto, BookmarkListResponseDto } from './dto/bookmark-response.dto';
import { DemandService } from 'src/demand/demand.service';
import { TravelService } from 'src/travel/travel.service';
import { CustomBadRequestException, CustomConflictException, CustomNotFoundException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';

@Injectable()
export class BookmarkService {
  constructor(
    private travelService: TravelService,
    private demandService: DemandService,
    @InjectRepository(BookmarkEntity)
    private bookmarkRepository: Repository<BookmarkEntity>,
    private readonly bookmarkMapper: BookmarkMapper,
  ) {}

  /**
   * Create a new bookmark
   */
  async create(userId: number, createBookmarkDto: CreateBookmarkDto): Promise<BookmarkItemResponseDto> {
    const { bookmarkType, travelId, demandId, notes } = createBookmarkDto;

    // Validate that the correct ID is provided based on bookmark type
    if (bookmarkType === BookmarkType.TRAVEL && !travelId) {
      throw new CustomBadRequestException('travelId is required when bookmarkType is TRAVEL', ErrorCode.BOOKMARK_TRAVEL_ID_REQUIRED);
    }

    if (bookmarkType === BookmarkType.DEMAND && !demandId) {
      throw new CustomBadRequestException('demandId is required when bookmarkType is DEMAND', ErrorCode.BOOKMARK_DEMAND_ID_REQUIRED);
    }

    // Verify that the travel or demand exists and check ownership
    if (bookmarkType === BookmarkType.TRAVEL && travelId) {
      const travel = await this.travelService.findOne({ where: { id: travelId } });
      if (!travel) {
        throw new CustomNotFoundException('Travel not found', 'TRAVEL_NOT_FOUND');
      }
      // Prevent users from bookmarking their own travels
      if (travel.userId === userId) {
        throw new CustomBadRequestException('You cannot bookmark your own travel', 'BOOKMARK_OWN_TRAVEL');
      } else if (travel.status === 'inactive') {
        throw new CustomBadRequestException('You cannot bookmark an inactive travel', 'BOOKMARK_INACTIVE_TRAVEL');
      }
    } else if (bookmarkType === BookmarkType.DEMAND && demandId) {
      const demand = await this.demandService.findOne({ where: { id: demandId } });
      if (!demand) {
        throw new CustomNotFoundException('Demand not found', 'DEMAND_NOT_FOUND');
      }
      // Prevent users from bookmarking their own demands
      if (demand.userId === userId) {
        throw new CustomBadRequestException('You cannot bookmark your own demand', 'BOOKMARK_OWN_DEMAND');
      } else if (demand.status === 'inactive') {
        throw new CustomBadRequestException('You cannot bookmark an inactive demand', 'BOOKMARK_INACTIVE_DEMAND');
      }
    }

    // Check if bookmark already exists
    const existingBookmark = await this.bookmarkRepository.findOne({
      where: {
        userId,
        bookmarkType,
        ...(travelId && { travelId }),
        ...(demandId && { demandId }),
      },
    });

    if (existingBookmark) {
      throw new CustomConflictException('Item already bookmarked', ErrorCode.BOOKMARK_ALREADY_EXISTS);
    }

    // Create the bookmark
    const bookmark = this.bookmarkRepository.create({
      userId,
      bookmarkType,
      ...(travelId && { travelId }),
      ...(demandId && { demandId }),
      notes,
    });
    const savedBookmark = await this.bookmarkRepository.save(bookmark);
    
    // Reload the bookmark with all relations including demand images
    const bookmarkWithRelations = await this.bookmarkRepository.findOne({
      where: { id: savedBookmark.id },
      relations: [
        'travel', 
        'travel.departureAirport', 
        'travel.arrivalAirport', 
        'travel.airline', 
        'travel.user',
        'demand', 
        'demand.departureAirport', 
        'demand.arrivalAirport', 
        'demand.user',
        'demand.images'
      ],
    });
    
    return this.bookmarkMapper.toBookmarkItemResponse(bookmarkWithRelations || savedBookmark);
  }

  /**
   * Get all bookmarks for a user with pagination and filtering
   */
  async findAll(
    userId: number | null,
    query: FindBookmarksQueryDto,
  ): Promise<BookmarkListResponseDto> {
    const { page = 1, limit = 10, bookmarkType, orderBy = 'createdAt:desc' } = query;

    const skip = (page - 1) * limit;

    // Build the query
    const queryBuilder = this.bookmarkRepository
      .createQueryBuilder('bookmark')
      .leftJoinAndSelect('bookmark.travel', 'travel')
      .leftJoinAndSelect('travel.departureAirport', 'travelDepartureAirport')
      .leftJoinAndSelect('travel.arrivalAirport', 'travelArrivalAirport')
      .leftJoinAndSelect('travel.airline', 'travelAirline')
      .leftJoinAndSelect('travel.user', 'travelUser')
      .leftJoinAndSelect('bookmark.demand', 'demand')
      .leftJoinAndSelect('demand.departureAirport', 'demandDepartureAirport')
      .leftJoinAndSelect('demand.arrivalAirport', 'demandArrivalAirport')
      .leftJoinAndSelect('demand.user', 'demandUser')
      .leftJoinAndSelect('demand.images', 'demandImages')
      .where('bookmark.userId = :userId', { userId })
      .skip(skip)
      .take(limit);

    // Apply filters
    if (bookmarkType) {
      queryBuilder.andWhere('bookmark.bookmarkType = :bookmarkType', { bookmarkType });
    }

    // Apply sorting
    const [sortField, sortDirection] = orderBy.split(':');
    if (sortField === 'createdAt') {
      queryBuilder.orderBy(
        `bookmark.${sortField}`,
        sortDirection.toUpperCase() as 'ASC' | 'DESC',
      );
    } else {
      queryBuilder.orderBy('bookmark.createdAt', 'DESC'); // default
    }

    // Get the count and items
    const totalItems = await queryBuilder.getCount();
    const bookmarks = await queryBuilder.getMany();

    // Map entities to DTOs
    const items = bookmarks.map(bookmark => 
      this.bookmarkMapper.toBookmarkItemResponse(bookmark)
    );

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };
  }

  /**
   * Get a single bookmark by ID
   */
  async findOne(userId: number, id: number): Promise<BookmarkEntity> {
    const bookmark = await this.bookmarkRepository.findOne({
      where: { id, userId },
      relations: ['travel', 'demand', 'travel.departureAirport', 'travel.arrivalAirport', 'demand.departureAirport', 'demand.arrivalAirport', 'demand.images'],
    });

    if (!bookmark) {
      throw new CustomNotFoundException('Bookmark not found', ErrorCode.BOOKMARK_NOT_FOUND);
    }

    return bookmark;
  }

  /**
   * Update a bookmark (only notes can be updated)
   */
  async update(
    userId: number,
    id: number,
    updateBookmarkDto: UpdateBookmarkDto,
  ): Promise<BookmarkEntity> {
    const bookmark = await this.findOne(userId, id);

    Object.assign(bookmark, updateBookmarkDto);
    return this.bookmarkRepository.save(bookmark);
  }

  /**
   * Remove a bookmark
   */
  async remove(userId: number, id: number): Promise<{ message: string }> {
    const bookmark = await this.findOne(userId, id);

    await this.bookmarkRepository.remove(bookmark);

    return { message: 'Bookmark removed successfully' };
  }

  /**
   * Remove bookmark by travel or demand ID
   */
  async removeByItem(
    userId: number,
    bookmarkType: BookmarkType,
    itemId: number,
  ): Promise<{ message: string }> {
    const whereCondition: any = {
      userId,
      bookmarkType,
    };

    if (bookmarkType === BookmarkType.TRAVEL) {
      whereCondition.travelId = itemId;
    } else {
      whereCondition.demandId = itemId;
    }

    const bookmark = await this.bookmarkRepository.findOne({
      where: whereCondition,
    });

    if (!bookmark) {
      throw new CustomNotFoundException('Bookmark not found', ErrorCode.BOOKMARK_NOT_FOUND );
    }

    await this.bookmarkRepository.remove(bookmark);

    return { message: 'Bookmark removed successfully' };
  }

  /**
   * Check if an item is bookmarked by the user
   */
  async isBookmarked(
    userId: number,
    bookmarkType: BookmarkType,
    itemId: number,
  ): Promise<{ isBookmarked: boolean; bookmarkId?: number }> {
    const whereCondition: any = {
      userId,
      bookmarkType,
    };

    if (bookmarkType === BookmarkType.TRAVEL) {
      whereCondition.travelId = itemId;
    } else {
      whereCondition.demandId = itemId;
    }

    const bookmark = await this.bookmarkRepository.findOne({
      where: whereCondition,
      select: ['id'],
    });

    return {
      isBookmarked: !!bookmark,
      bookmarkId: bookmark?.id,
    };
  }

  /**
   * Get bookmark count by type for a user
   */
  async getBookmarkStats(userId: number): Promise<{
    totalBookmarks: number;
    travelBookmarks: number;
    demandBookmarks: number;
  }> {
    const [totalBookmarks, travelBookmarks, demandBookmarks] = await Promise.all([
      this.bookmarkRepository.count({ where: { userId } }),
      this.bookmarkRepository.count({
        where: { userId, bookmarkType: BookmarkType.TRAVEL },
      }),
      this.bookmarkRepository.count({
        where: { userId, bookmarkType: BookmarkType.DEMAND },
      }),
    ]);

    return {
      totalBookmarks,
      travelBookmarks,
      demandBookmarks,
    };
  }
}
