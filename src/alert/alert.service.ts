import { Injectable, NotFoundException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AlertEntity, AlertType } from './entities/alert.entity';
import { CreateAlertDto } from './dto/request/create-alert.dto';
import { FindAlertQueryDto } from './dto/request/find-alert.query.dto';
import { AlertResponseDto } from './dto/response/alert-response.dto';
import { PaginatedAlertResponseDto } from './dto/response/paginated-alert-response.dto';
import { AlertMapper } from './alert.mapper';
import { UserRole } from 'src/user/user.entity';
import { CustomNotFoundException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { EmailService } from 'src/email/email.service';
import { EmailTemplatesService } from 'src/email/email-templates.service';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationType, EntityType, NotificationPriority } from 'src/notification/entities/notification.entity';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private alertListCacheKeys: Set<string> = new Set();

    constructor(
    @InjectRepository(AlertEntity)
    private alertRepository: Repository<AlertEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private alertMapper: AlertMapper,
    private emailService: EmailService,
    private emailTemplatesService: EmailTemplatesService,
    private notificationService: NotificationService, 
  ) {}

  /**
   * Create a new alert
   */
  async create(createAlertDto: CreateAlertDto, userId: number): Promise<AlertResponseDto> {
    const alertData: Partial<AlertEntity> = {
      userId: userId,
      departureAirportId: createAlertDto.departureAirportId,
      arrivalAirportId: createAlertDto.arrivalAirportId,
      alertType: createAlertDto.alertType || AlertType.TRAVEL,
      flightNumber: createAlertDto.flightNumber || null,
      travelDateTime: createAlertDto.travelDateTime ? new Date(createAlertDto.travelDateTime) : null,
      createdBy: userId,
    };

    const alert = this.alertRepository.create(alertData);
    const savedAlert = await this.alertRepository.save(alert);

    // Clear cache for alert lists
    await this.clearAlertListCache();

    // Fetch with relations for response
    const alertWithRelations = await this.alertRepository.findOne({
      where: { id: savedAlert.id },
      relations: ['departureAirport', 'arrivalAirport', 'user'],
    });

    if (!alertWithRelations) {
      throw new CustomNotFoundException(`Alert with ID ${savedAlert.id} not found`, ErrorCode.ALERT_NOT_FOUND);
    }

    // Send confirmation email to user
    try {
      const user = alertWithRelations.user;
      if (user && user.email) {
        const emailTemplate = this.emailTemplatesService.getAlertCreatedEmailTemplate({
          userName: user.firstName || 'User',
          alertType: alertWithRelations.alertType,
          departureAirport: alertWithRelations.departureAirport?.name || 'Unknown',
          arrivalAirport: alertWithRelations.arrivalAirport?.name || 'Unknown',
          flightNumber: alertWithRelations.flightNumber,
          travelDate: alertWithRelations.travelDateTime 
            ? new Date(alertWithRelations.travelDateTime).toLocaleDateString() 
            : null,
          alertId: savedAlert.id,
        });

        const emailSent = await this.emailService.sendEmail({
          to: user.email,
          subject: 'Alert Created Successfully - GoHappyGo',
          html: emailTemplate,
        });

        if (emailSent) {
          this.logger.log(`Alert creation confirmation email sent to ${user.email} for alert ${savedAlert.id}`);
        } else {
          this.logger.warn(`Failed to send alert creation confirmation email to ${user.email} for alert ${savedAlert.id}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error sending alert creation confirmation email: ${error.message}`, error.stack);
      // Don't fail alert creation if email fails
    }

    // Create notification for user
    try {
      await this.notificationService.create({
        targetUserId: userId,
        actorUserId: userId,
        notificationType: NotificationType.SYSTEM_ANNOUNCEMENT,
        entityType: EntityType.USER,
        entityId: userId,
        title: 'Alert Created Successfully',
        priority: NotificationPriority.NORMAL,
      });
      this.logger.log(`Notification created for alert ${savedAlert.id} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error creating notification for alert: ${error.message}`, error.stack);
      // Don't fail alert creation if notification fails
    }

    return this.alertMapper.toResponseDto(alertWithRelations);
  }

  /**
   * Get alerts with filtering, pagination, and sorting
   * Admins can see all alerts, normal users only their own
   */
  async findAll(query: FindAlertQueryDto, user: any): Promise<PaginatedAlertResponseDto> {
    const {
      page = 1,
      limit = 10,
      alertType,
      flightNumber,
      departureAirportId,
      arrivalAirportId,
      travelDate,
      orderBy = 'createdAt:desc',
    } = query;

    // Check if user is admin or operator
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.OPERATOR;
    const userId = user?.id;

    // Generate cache key
    const cacheKey = this.generateAlertListCacheKey(query, userId, isAdmin);
    this.alertListCacheKeys.add(cacheKey);

    // Check cache first
    const cachedData = await this.cacheManager.get<PaginatedAlertResponseDto>(cacheKey);
    if (cachedData) {
      this.logger.log(`Cache Hit - Returning alerts from cache: ${cacheKey}`);
      return cachedData;
    }

    this.logger.log(`Cache Miss - Fetching alerts from database`);

    const skip = (page - 1) * limit;

    // Build query
    const queryBuilder = this.alertRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.departureAirport', 'departureAirport')
      .leftJoinAndSelect('alert.arrivalAirport', 'arrivalAirport')
      .leftJoinAndSelect('alert.user', 'user')
      .where('alert.deletedAt IS NULL'); // Exclude soft-deleted alerts

    // Normal users can only see their own alerts
    if (!isAdmin) {
      if (!userId) {
        throw new ForbiddenException('User ID is required');
      }
      queryBuilder.andWhere('alert.userId = :userId', { userId });
    }

    // Apply filters
    if (alertType) {
      queryBuilder.andWhere('alert.alertType = :alertType', { alertType });
    }

    if (flightNumber) {
      queryBuilder.andWhere('alert.flightNumber = :flightNumber', { flightNumber });
    }

    if (departureAirportId) {
      queryBuilder.andWhere('alert.departureAirportId = :departureAirportId', { departureAirportId });
    }

    if (arrivalAirportId) {
      queryBuilder.andWhere('alert.arrivalAirportId = :arrivalAirportId', { arrivalAirportId });
    }

    if (travelDate) {
      const targetDate = new Date(travelDate);
      queryBuilder.andWhere('DATE(alert.travelDateTime) = DATE(:travelDate)', { travelDate: targetDate });
    }

    // Apply sorting
    const [sortField, sortDirection] = orderBy.split(':');
    const validSortFields = ['createdAt', 'travelDateTime'];
    const validSortDirections = ['asc', 'desc'];

    if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      queryBuilder.orderBy(`alert.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy('alert.createdAt', 'DESC'); // default
    }

    // Get total count
    const totalItems = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const alerts = await queryBuilder.getMany();

    // Map to response DTOs
    const alertResponses = alerts.map(alert => this.alertMapper.toResponseDto(alert));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);

    const responseResult: PaginatedAlertResponseDto = {
      items: alertResponses,
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
    await this.cacheManager.set(cacheKey, responseResult, 30000); // 30 seconds TTL
    return responseResult;
  }

  /**
   * Delete an alert (soft delete)
   * Users can delete their own alerts, admins can delete any alert
   */
  async remove(id: number, user: any): Promise<void> {
    const alert = await this.alertRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!alert) {
      throw new CustomNotFoundException(`Alert with ID ${id} not found`, ErrorCode.ALERT_NOT_FOUND);
    }

    // Check if alert is already deleted
    if (alert.deletedAt) {
      throw new CustomNotFoundException(`Alert with ID ${id} is already deleted`, ErrorCode.ALERT_NOT_FOUND);
    }

    // Check permissions
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.OPERATOR;
    if (!isAdmin && alert.userId !== user?.id) {
      throw new ForbiddenException('You can only delete your own alerts');
    }

    // Soft delete
    await this.alertRepository.softDelete(id);

    // Clear cache
    await this.clearAlertListCache();

    this.logger.log(`Alert ${id} soft deleted by user ${user?.id}`);
  }

  /**
   * Find matching alerts for a demand or travel
   * Used by the alert listener to check if any alerts match a newly created demand/travel
   */
  async findMatchingAlerts(
    departureAirportId: number,
    arrivalAirportId: number,
    flightNumber: string | null,
    travelDate: Date | null,
    alertType: 'DEMAND' | 'TRAVEL',
  ): Promise<AlertEntity[]> {
    const queryBuilder = this.alertRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.user', 'user')
      .leftJoinAndSelect('alert.departureAirport', 'departureAirport')
      .leftJoinAndSelect('alert.arrivalAirport', 'arrivalAirport')
      .where('alert.deletedAt IS NULL')
      .andWhere('alert.departureAirportId = :departureAirportId', { departureAirportId })
      .andWhere('alert.arrivalAirportId = :arrivalAirportId', { arrivalAirportId });

    // Match alert type: BOTH matches everything, or specific type matches
    queryBuilder.andWhere(
      '(alert.alertType = :bothType OR alert.alertType = :specificType)',
      { bothType: AlertType.BOTH, specificType: alertType },
    );

    // If flight number is provided, match it (or if alert doesn't have flight number specified)
    if (flightNumber) {
      queryBuilder.andWhere(
        '(alert.flightNumber IS NULL OR alert.flightNumber = :flightNumber)',
        { flightNumber },
      );
    }

    // If travel date is provided, match it (or if alert doesn't have travel date specified)
    if (travelDate) {
      const travelDateOnly = new Date(travelDate);
      travelDateOnly.setHours(0, 0, 0, 0);
      const nextDay = new Date(travelDateOnly);
      nextDay.setDate(nextDay.getDate() + 1);

      queryBuilder.andWhere(
        '(alert.travelDateTime IS NULL OR (DATE(alert.travelDateTime) = DATE(:travelDate)))',
        { travelDate },
      );
    }

    return await queryBuilder.getMany();
  }

  /**
   * Generate cache key for alert list queries
   */
  private generateAlertListCacheKey(query: FindAlertQueryDto, userId: number | null, isAdmin: boolean): string {
    const {
      page = 1,
      limit = 10,
      alertType,
      flightNumber,
      departureAirportId,
      arrivalAirportId,
      travelDate,
      orderBy = 'createdAt:desc',
    } = query;

    const normalize = (value: any): string => {
      if (value === null || value === undefined || value === '') {
        return 'all';
      }
      return String(value);
    };

    const userContext = isAdmin ? 'admin' : `user${userId || 'anon'}`;

    return `alert_list_${userContext}_page${normalize(page)}_limit${normalize(limit)}_type${normalize(alertType)}_flight${normalize(flightNumber)}_dep${normalize(departureAirportId)}_arr${normalize(arrivalAirportId)}_date${normalize(travelDate)}_order${normalize(orderBy)}`;
  }

  /**
   * Clear all alert list cache
   */
  async clearAlertListCache(): Promise<void> {
    for (const cacheKey of this.alertListCacheKeys) {
      await this.cacheManager.del(cacheKey);
    }
    this.alertListCacheKeys.clear();
  }
}
