import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual, MoreThanOrEqual, Between } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { NotificationEntity } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto';
import { NotificationResponseDto, NotificationCountResponseDto, PaginatedNotificationsResponseDto } from './dto/notification-response.dto';
import { NotificationMapper } from './notification.mapper';
import { CustomNotFoundException, CustomForbiddenException, CustomBadRequestException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';

@Injectable()
export class NotificationService {
  private notificationCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(NotificationEntity)
    private notificationRepository: Repository<NotificationEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private notificationMapper: NotificationMapper,
  ) {}

  /**
   * Create a new notification
   */
  async create(createNotificationDto: CreateNotificationDto): Promise<NotificationEntity> {
    const notification = this.notificationRepository.create(createNotificationDto);
    const savedNotification = await this.notificationRepository.save(notification);
    
    // Clear cache for the target user
    await this.clearUserNotificationCache(createNotificationDto.targetUserId);
    
    return savedNotification;
  }

  /**
   * Get notifications for a user with pagination and filters
   */
  async getUserNotifications(
    userId: number,
    query: FindNotificationsQueryDto
  ): Promise<PaginatedNotificationsResponseDto> {
    const {
      page = 1,
      limit = 20,
      type,
      unreadOnly,
      priority,
      startDate,
      endDate,
    } = query;

    // Generate cache key
    const cacheKey = this.generateNotificationCacheKey(userId, query);
    this.notificationCacheKeys.add(cacheKey);

    // Check cache
    const cachedData = await this.cacheManager.get<PaginatedNotificationsResponseDto>(cacheKey);
    if (cachedData) {
      console.log(`Cache Hit: Returning notifications from cache for user ${userId}`);
      return cachedData;
    }

    console.log(`Cache Miss: Fetching notifications from database for user ${userId}`);

    const skip = (page - 1) * limit;

    // Build query
    const queryBuilder = this.notificationRepository.createQueryBuilder('notification')
      .leftJoinAndSelect('notification.actor', 'actor')
      .where('notification.targetUserId = :userId', { userId })
      .andWhere('notification.deletedAt IS NULL')
      .skip(skip)
      .take(limit)
      .orderBy('notification.createdAt', 'DESC');

    // Apply filters
    if (type) {
      queryBuilder.andWhere('notification.notificationType = :type', { type });
    }

    if (unreadOnly) {
      queryBuilder.andWhere('notification.readAt IS NULL');
    }

    if (priority) {
      queryBuilder.andWhere('notification.priority = :priority', { priority });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('notification.createdAt BETWEEN :startDate AND :endDate', { 
        startDate: new Date(startDate), 
        endDate: new Date(endDate) 
      });
    } else if (startDate) {
      queryBuilder.andWhere('notification.createdAt >= :startDate', { startDate: new Date(startDate) });
    } else if (endDate) {
      queryBuilder.andWhere('notification.createdAt <= :endDate', { endDate: new Date(endDate) });
    }

    // Get total count
    const totalItems = await queryBuilder.getCount();

    // Get notifications
    const notifications = await queryBuilder.getMany();

    // Map to DTOs
    const items = notifications.map(notification => this.notificationMapper.toResponseDto(notification));

    const totalPages = Math.ceil(totalItems / limit);
    const result = {
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

    // Cache the result
    await this.cacheManager.set(cacheKey, result, 60000); // Cache for 1 minute

    return result;
  }

  /**
   * Get count of unread and total notifications for a user
   */
  async getNotificationCounts(userId: number): Promise<NotificationCountResponseDto> {
    const cacheKey = `notification_counts_user${userId}`;
    
    // Check cache
    const cached = await this.cacheManager.get<NotificationCountResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get counts
    const [unreadCount, totalCount] = await Promise.all([
      this.notificationRepository.count({
        where: { 
          targetUserId: userId, 
          readAt: IsNull(), 
          deletedAt: IsNull() 
        }
      }),
      this.notificationRepository.count({
        where: { 
          targetUserId: userId, 
          deletedAt: IsNull() 
        }
      })
    ]);

    const counts = { unreadCount, totalCount };

    // Cache for 1 minute
    await this.cacheManager.set(cacheKey, counts, 60000);

    return counts;
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: number, userId: number): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, deletedAt: IsNull() },
      relations: ['actor']
    });

    if (!notification) {
      throw new CustomNotFoundException(
        `Notification with id ${notificationId} not found`,
        ErrorCode.NOTIFICATION_NOT_FOUND
      );
    }

    // Check ownership
    if (notification.targetUserId !== userId) {
      throw new CustomForbiddenException(
        'You can only mark your own notifications as read',
        ErrorCode.NOTIFICATION_UNAUTHORIZED
      );
    }

    // Already read
    if (notification.readAt) {
      return this.notificationMapper.toResponseDto(notification);
    }

    // Mark as read
    notification.readAt = new Date();
    const updated = await this.notificationRepository.save(notification);

    // Clear cache
    await this.clearUserNotificationCache(userId);

    return this.notificationMapper.toResponseDto(updated);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<{ affected: number }> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(NotificationEntity)
      .set({ readAt: new Date() })
      .where('targetUserId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .andWhere('deletedAt IS NULL')
      .execute();

    // Clear cache
    await this.clearUserNotificationCache(userId);

    return { affected: result.affected || 0 };
  }

  /**
   * Delete (soft delete) a notification
   */
  async deleteNotification(notificationId: number, userId: number): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, deletedAt: IsNull() }
    });

    if (!notification) {
      throw new CustomNotFoundException(
        `Notification with id ${notificationId} not found`,
        ErrorCode.NOTIFICATION_NOT_FOUND
      );
    }

    // Check ownership
    if (notification.targetUserId !== userId) {
      throw new CustomForbiddenException(
        'You can only delete your own notifications',
        ErrorCode.NOTIFICATION_UNAUTHORIZED
      );
    }

    // Soft delete
    notification.deletedAt = new Date();
    await this.notificationRepository.save(notification);

    // Clear cache
    await this.clearUserNotificationCache(userId);
  }

  /**
   * Clear all read notifications for a user
   */
  async clearReadNotifications(userId: number): Promise<{ affected: number }> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(NotificationEntity)
      .set({ deletedAt: new Date() })
      .where('targetUserId = :userId', { userId })
      .andWhere('readAt IS NOT NULL')
      .andWhere('deletedAt IS NULL')
      .execute();

    // Clear cache
    await this.clearUserNotificationCache(userId);

    return { affected: result.affected || 0 };
  }

  /**
   * Generate cache key for notifications
   */
  private generateNotificationCacheKey(userId: number, query: FindNotificationsQueryDto): string {
    const {
      page = 1,
      limit = 20,
      type,
      unreadOnly,
      priority,
      startDate,
      endDate,
    } = query;

    return `notifications_user${userId}_page${page}_limit${limit}_type${type || 'all'}_unread${unreadOnly || 'all'}_priority${priority || 'all'}_start${startDate || 'all'}_end${endDate || 'all'}`;
  }

  /**
   * Clear cache for a specific user's notifications
   */
  private async clearUserNotificationCache(userId: number): Promise<void> {
    // Clear specific user cache patterns
    const userCachePattern = `notifications_user${userId}`;
    const countsCacheKey = `notification_counts_user${userId}`;

    // Clear counts cache
    await this.cacheManager.del(countsCacheKey);

    // Clear notification list caches
    for (const cacheKey of this.notificationCacheKeys) {
      if (cacheKey.includes(userCachePattern)) {
        await this.cacheManager.del(cacheKey);
      }
    }
  }
}
