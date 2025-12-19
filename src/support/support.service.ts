import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SupportRequestEntity, SupportStatus } from './entities/support-request.entity';
import { SupportLogEntity } from './entities/support-log.entity';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { FindSupportRequestsQueryDto } from './dto/find-support-requests-query.dto';
import { RespondSupportRequestDto } from './dto/respond-support-request.dto';
import { SupportRequestResponseDto } from './dto/support-request-response.dto';
import { PaginatedSupportRequestsResponseDto } from './dto/paginated-support-requests-response.dto';
import { SupportMapper } from './support.mapper';
import { EmailService } from '../email/email.service';
import { EmailTemplatesService } from '../email/email-templates.service';
import { UserEntity, UserRole } from '../user/user.entity';

import { ErrorCode } from '../common/exception/error-codes';
import { CustomNotFoundException, CustomForbiddenException, CustomBadRequestException } from 'src/common/exception/custom-exceptions';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportRequestEntity)
    private readonly supportRequestRepository: Repository<SupportRequestEntity>,
    @InjectRepository(SupportLogEntity)
    private readonly supportLogRepository: Repository<SupportLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly supportMapper: SupportMapper,
    private readonly emailService: EmailService,
    private readonly emailTemplatesService: EmailTemplatesService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new support request (accessible by visitors and users)
   */
  async createSupportRequest(
    createDto: CreateSupportRequestDto,
  ): Promise<SupportRequestResponseDto> {
    // Create support request entity
    const supportRequest = this.supportRequestRepository.create({
      email: createDto.email,
      message: createDto.message,
      supportRequesterType: createDto.supportRequesterType,
      supportCategory: createDto.supportCategory,
      status: SupportStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedRequest = await this.supportRequestRepository.save(supportRequest);

    // Send confirmation email to requester
    const confirmationTemplate = this.emailTemplatesService.getSupportRequestConfirmationTemplate({
      requestId: savedRequest.id,
      email: savedRequest.email,
      category: savedRequest.supportCategory,
    });

    await this.emailService.sendEmail({
      to: savedRequest.email,
      subject: 'Support Request Received - GoHappyGo',
      html: confirmationTemplate,
    });

    // Send notification email to support team
    const supportEmail = this.configService.get<string>('SUPPORT_EMAIL');
    if (supportEmail) {
      const notificationTemplate = this.emailTemplatesService.getSupportRequestReceivedTemplate({
        requestId: savedRequest.id,
        email: savedRequest.email,
        message: savedRequest.message,
        category: savedRequest.supportCategory,
        requesterType: savedRequest.supportRequesterType,
      });

      await this.emailService.sendEmail({
        to: supportEmail,
        subject: `New Support Request #${savedRequest.id} - ${savedRequest.supportCategory}`,
        html: notificationTemplate,
      });
    }

    return this.supportMapper.toSupportRequestResponse(savedRequest);
  }

  /**
   * Get all support requests with filtering and pagination
   * Non-admin/operator users can only see their own requests
   */
  async getSupportRequests(
    query: FindSupportRequestsQueryDto,
    user?: UserEntity,
  ): Promise<PaginatedSupportRequestsResponseDto> {
    const { page = 1, limit = 10, status, category, email, requesterType } = query;
    console.log('user', user);

    const queryBuilder = this.supportRequestRepository
      .createQueryBuilder('support')
      .leftJoinAndSelect('support.logs', 'logs')
      .orderBy('support.createdAt', 'DESC')
      .addOrderBy('logs.createdAt', 'ASC');

    // Authorization: Non-admin/operator can only see their own requests
    const isAdminOrOperator = user && (user.role?.code === UserRole.ADMIN || user.role?.code === UserRole.OPERATOR);
    if (!isAdminOrOperator) {
      // Non-admin/operator users can only see their own requests
      console.log('user', user);
      if (!user || !user.email) {
        // If not authenticated or no email, return empty results
        return {
          data: [],
          page,
          limit,
          total: 0,
          totalPages: 0,
        };
      }
      // Always filter by user's email for non-admin users (ignore email query param)
      queryBuilder.andWhere('support.email = :userEmail', { userEmail: user.email });
    } else {
      // Admin/Operator can use email filter if provided
      if (email) {
        queryBuilder.andWhere('support.email LIKE :email', { email: `%${email}%` });
      }
    }

    // Apply filters
    if (status) {
      queryBuilder.andWhere('support.status = :status', { status });
    }

    if (category) {
      queryBuilder.andWhere('support.supportCategory = :category', { category });
    }

    if (requesterType) {
      queryBuilder.andWhere('support.supportRequesterType = :requesterType', { requesterType });
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const supportRequests = await queryBuilder.getMany();

    // Collect all unique user IDs from logs
    const userIds = new Set<number>();
    supportRequests.forEach(request => {
      request.logs?.forEach(log => {
        if (log.userId) {
          userIds.add(log.userId);
        }
      });
    });

    // Fetch all users at once
    const users = await this.getUsersMap(Array.from(userIds));

    // Map to DTOs
    const data = this.supportMapper.toSupportRequestResponseList(supportRequests, users);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single support request by ID
   */
  async getSupportRequestById(
    id: number,
    user?: UserEntity,
  ): Promise<SupportRequestResponseDto> {
    const supportRequest = await this.supportRequestRepository.findOne({
      where: { id },
      relations: ['logs'],
    });

    if (!supportRequest) {
      throw new CustomNotFoundException('Support request not found', ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }

    // Authorization check
    if (user && user.role?.code !== UserRole.ADMIN && user.role?.code !== UserRole.OPERATOR) {
      if (supportRequest.email !== user.email) {
        throw new CustomForbiddenException(
          'You can only view your own support requests',
          ErrorCode.SUPPORT_REQUEST_UNAUTHORIZED,
        );
      }
    }

    // Collect user IDs
    const userIds = supportRequest.logs
      ?.filter(log => log.userId !== null && log.userId !== undefined)
      .map(log => log.userId as number) || [];

    const users = await this.getUsersMap(userIds);

    return this.supportMapper.toSupportRequestResponse(supportRequest, users);
  }

  /**
   * Operator responds to a support request
   * Creates a support log and sends email to requester
   */
  async respondToSupportRequest(
    id: number,
    respondDto: RespondSupportRequestDto,
    operator: UserEntity,
  ): Promise<SupportRequestResponseDto> {
    console.log("support request id", id);
    // Verify operator role
    if (operator.role?.code !== UserRole.ADMIN && operator.role?.code !== UserRole.OPERATOR) {
      throw new CustomForbiddenException(
        'Only operators and admins can respond to support requests',
        ErrorCode.SUPPORT_OPERATOR_REQUIRED,
      );
    }

    const supportRequest = await this.supportRequestRepository.findOne({
      where: { id },
      relations: ['logs'],
    });

    if (!supportRequest) {
      throw new CustomNotFoundException('Support request not found', ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }

    if (supportRequest.status === SupportStatus.CLOSED) {
      throw new CustomBadRequestException(
        'Cannot respond to a closed support request',
        ErrorCode.SUPPORT_REQUEST_ALREADY_CLOSED,
      );
    }

    // Check for duplicate logs created in the last 2 seconds to prevent triple creation
    const twoSecondsAgo = new Date(Date.now() - 2000);
    const recentLogs = await this.supportLogRepository.find({
      where: {
        supportRequestId: id,
        message: respondDto.message,
        isGohappyGoTeam: true,
        userId: operator.id,
      },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    // Only create log if no duplicate exists within last 2 seconds
    if (recentLogs.length === 0 || !recentLogs[0].createdAt || new Date(recentLogs[0].createdAt) < twoSecondsAgo) {
      console.log(`[SupportService] Creating new log for request ${id} by operator ${operator.id}`);
      const log = new SupportLogEntity();
      log.supportRequestId = id;
      log.message = respondDto.message;
      log.isRead = false;
      log.isGohappyGoTeam = true;
      log.userId = operator.id;
      log.createdAt = new Date();
      await this.supportLogRepository.save(log);
      console.log(`[SupportService] Log created successfully with ID: ${log.id}`);
    } else {
      console.log(`[SupportService] Duplicate log creation prevented - recent log found with ID: ${recentLogs[0].id}`);
    }

    // Update support request status to RESOLVING if it was PENDING
    // Use update() instead of save() to avoid relation management issues
    if (supportRequest.status === SupportStatus.PENDING) {
      await this.supportRequestRepository.update(id, {
        status: SupportStatus.RESOLVING,
        updatedAt: new Date(),
      });
    }

    // Send email to requester
    const responseTemplate = this.emailTemplatesService.getSupportResponseFromOperatorTemplate({
      requestId: supportRequest.id,
      email: supportRequest.email,
      message: respondDto.message,
      category: supportRequest.supportCategory,
    });

    await this.emailService.sendEmail({
      from: this.configService.get<string>('SUPPORT_EMAIL') || 'support@gohappygo.fr',
      to: supportRequest.email,
      subject: `Response to Support Request #${supportRequest.id}`,
      html: responseTemplate,
    });

    // Reload with updated data
    const updatedRequest = await this.supportRequestRepository.findOne({
      where: { id },
      relations: ['logs'],
    });

    if (!updatedRequest) {
      throw new CustomNotFoundException('Support request not found', ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }

    const userIds = updatedRequest.logs
      ?.filter(log => log.userId !== null && log.userId !== undefined)
      .map(log => log.userId as number) || [];

    const users = await this.getUsersMap(userIds);

    return this.supportMapper.toSupportRequestResponse(updatedRequest, users);
  }

  /**
   * User/Visitor replies to operator's response
   * Creates a support log and sends email to support team
   */
  async replyToSupportRequest(
    id: number,
    respondDto: RespondSupportRequestDto,
    user?: UserEntity,
  ): Promise<SupportRequestResponseDto> {
    const supportRequest = await this.supportRequestRepository.findOne({
      where: { id },
      relations: ['logs'],
    });

    if (!supportRequest) {
      throw new CustomNotFoundException('Support request not found', ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }

    // Authorization: user can only reply to their own support requests
    if (user && supportRequest.email !== user.email) {
      throw new CustomForbiddenException(
        'You can only reply to your own support requests',
        ErrorCode.SUPPORT_REQUEST_UNAUTHORIZED,
      );
    }

    if (supportRequest.status === SupportStatus.CLOSED) {
      throw new CustomBadRequestException(
        'Cannot reply to a closed support request',
        ErrorCode.SUPPORT_REQUEST_ALREADY_CLOSED,
      );
    }

    // Create support log - use new instance to avoid relation issues
    const log = new SupportLogEntity();
    log.supportRequestId = id;
    log.message = respondDto.message;
    log.isRead = false;
    log.isGohappyGoTeam = false;
    log.userId = user?.id ?? null;
    log.createdAt = new Date();
    
    await this.supportLogRepository.save(log);

    // Update support request status back to PENDING if it was RESOLVING
    // Use update() instead of save() to avoid relation management issues
    if (supportRequest.status === SupportStatus.RESOLVING) {
      await this.supportRequestRepository.update(id, {
        status: SupportStatus.PENDING,
        updatedAt: new Date(),
      });
    }

    // Send email to support team
    const supportEmail = this.configService.get<string>('SUPPORT_EMAIL');
    if (supportEmail) {
      const replyTemplate = this.emailTemplatesService.getSupportReplyFromUserTemplate({
        requestId: supportRequest.id,
        email: supportRequest.email,
        message: respondDto.message,
        category: supportRequest.supportCategory,
      });

      await this.emailService.sendEmail({
        to: supportEmail,
        subject: `User Reply to Support Request #${supportRequest.id}`,
        html: replyTemplate,
      });
    }

    // Reload with updated data
    const updatedRequest = await this.supportRequestRepository.findOne({
      where: { id },
      relations: ['logs'],
    });

    if (!updatedRequest) {
      throw new CustomNotFoundException('Support request not found', ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }

    const userIds = updatedRequest.logs
      ?.filter(log => log.userId !== null && log.userId !== undefined)
      .map(log => log.userId as number) || [];

    const users = await this.getUsersMap(userIds);

    return this.supportMapper.toSupportRequestResponse(updatedRequest, users);
  }

  /**
   * Operator closes a support request
   */
  async closeSupportRequest(
    id: number,
    operator: UserEntity,
  ): Promise<SupportRequestResponseDto> {
    // Verify operator role
    if (operator.role?.code !== UserRole.ADMIN && operator.role?.code !== UserRole.OPERATOR) {
      throw new CustomForbiddenException(
        'Only operators and admins can close support requests',
        ErrorCode.SUPPORT_OPERATOR_REQUIRED,
      );
    }

    const supportRequest = await this.supportRequestRepository.findOne({
      where: { id },
      relations: ['logs'],
    });

    if (!supportRequest) {
      throw new CustomNotFoundException('Support request not found', ErrorCode.SUPPORT_REQUEST_NOT_FOUND);
    }

    if (supportRequest.status === SupportStatus.CLOSED) {
      throw new CustomBadRequestException(
        'Support request is already closed',
        ErrorCode.SUPPORT_REQUEST_ALREADY_CLOSED,
      );
    }

    // Update status to CLOSED
    // Use update() instead of save() to avoid relation management issues
    await this.supportRequestRepository.update(id, {
      status: SupportStatus.CLOSED,
      updatedAt: new Date(),
    });

    // Send notification email to requester
    const closedTemplate = this.emailTemplatesService.getSupportRequestClosedTemplate({
      requestId: supportRequest.id,
      email: supportRequest.email,
      category: supportRequest.supportCategory,
    });

    await this.emailService.sendEmail({
      to: supportRequest.email,
      subject: `Support Request #${supportRequest.id} Closed`,
      html: closedTemplate,
    });

    const userIds = supportRequest.logs
      ?.filter(log => log.userId !== null && log.userId !== undefined)
      .map(log => log.userId as number) || [];

    const users = await this.getUsersMap(userIds);

    return this.supportMapper.toSupportRequestResponse(supportRequest, users);
  }

  /**
   * Helper method to fetch users and create a map
   */
  private async getUsersMap(userIds: number[]): Promise<Map<number, UserEntity>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const users = await this.userRepository.findByIds(userIds);
    const userMap = new Map<number, UserEntity>();

    users.forEach(user => {
      userMap.set(user.id, user);
    });

    return userMap;
  }
}
