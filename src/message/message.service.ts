import { Injectable, NotFoundException, Inject, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MessageEntity } from './message.entity';
import { Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';
import { RequestService } from 'src/request/request.service';
import { RequestEntity } from 'src/request/request.entity';
import { UserEntity } from 'src/user/user.entity';
import { SendMessageDto } from './dto/SendMessage.dto';
import { FindThreadQueryDto } from './dto/request/find-thread-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TravelEntity } from 'src/travel/travel.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { EmailService } from 'src/email/email.service';
import { EmailTemplatesService } from 'src/email/email-templates.service';
import { CustomNotFoundException, CustomBadRequestException, CustomForbiddenException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { ContactAnnouncerDto, AnnouncementType, isValidAnnouncementPublicId } from './dto/contact-announcer.dto';
import { CommonService } from 'src/common/service/common.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);
  private threadCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(MessageEntity) private messageRepository: Repository<MessageEntity>,
    @InjectRepository(RequestEntity) private requestRepository: Repository<RequestEntity>,
    @InjectRepository(TravelEntity) private travelRepository: Repository<TravelEntity>,
    @InjectRepository(DemandEntity) private demandRepository: Repository<DemandEntity>,
    private userService: UserService,
    private requestService: RequestService,
    private emailService: EmailService,
    private emailTemplatesService: EmailTemplatesService,
    private commonService: CommonService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async sendMessage(sender: UserEntity, dto: SendMessageDto): Promise<MessageEntity> {
    // Load request with all necessary relations to determine the receiver
    const request = await this.requestRepository.findOne({
      where: { id: dto.requestId },
      relations: ['requester', 'travel', 'travel.user', 'demand', 'demand.user'],
    });
    
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    // Automatically determine the receiver based on the request
    // If sender is the requester, receiver is the travel/demand owner
    // If sender is the travel/demand owner, receiver is the requester
    let receiver: UserEntity | null = null;

    if (request.requesterId === sender.id) {
      // Sender is the requester, so receiver is the travel/demand owner
      if (request.travelId && request.travel) {
        receiver = request.travel.user;
      } else if (request.demandId && request.demand) {
        receiver = request.demand.user;
      }
    } else {
      // Sender is the travel/demand owner, so receiver is the requester
      receiver = request.requester;
    }

    if (!receiver) {
      throw new NotFoundException('Could not determine receiver for this request');
    }

    // Validate that sender is actually part of this request
    const isRequester = request.requesterId === sender.id;
    const isTravelOwner = request.travelId && request.travel?.user?.id === sender.id;
    const isDemandOwner = request.demandId && request.demand?.user?.id === sender.id;

    if (!isRequester && !isTravelOwner && !isDemandOwner) {
      throw new ForbiddenException('You are not authorized to send messages for this request');
    }

    const message = this.messageRepository.create({
      content: dto.content,
      sender,
      receiver,
      request,
      isRead: false,
      createdBy: sender.id,
    });
    
    const savedMessage = await this.messageRepository.save(message);
    
    // Clear thread cache for this request (affects both sender and receiver)
    await this.clearThreadCache(dto.requestId);
    
    return savedMessage;
  }

  async getThread(
    requestId: number,
    user: UserEntity,
    query: FindThreadQueryDto,
  ): Promise<{ items: MessageEntity[]; total: number }> {
    // Generate cache key
    const cacheKey = this.generateThreadCacheKey(requestId, user.id, query);
    
    // Try to get from cache
    const cached = await this.cacheManager.get<{ items: MessageEntity[]; total: number }>(cacheKey);
    if (cached) {
      this.logger.log(`Cache hit for thread ${requestId} (User: ${user.id})`);
      return cached;
    }

    // Parse pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Parse sorting
    let orderBy: { [key: string]: 'ASC' | 'DESC' } = { createdAt: 'ASC' };
    if (query.orderBy) {
      const [field, direction] = query.orderBy.split(':');
      if (field && direction && ['createdAt', 'id'].includes(field) && ['asc', 'desc'].includes(direction.toLowerCase())) {
        orderBy = { [field]: direction.toUpperCase() as 'ASC' | 'DESC' };
      }
    }

    // Build base query for counting (without joins and pagination)
    const countQueryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .where('message.requestId = :requestId', { requestId })
      .andWhere('message.deletedAt IS NULL');

    // Build query for fetching messages (with joins and pagination)
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.receiver', 'receiver')
      .where('message.requestId = :requestId', { requestId })
      .andWhere('message.deletedAt IS NULL');

    // Add message text filter if provided
    if (query.messageText && query.messageText.trim()) {
      const messageTextFilter = `%${query.messageText.trim()}%`;
      queryBuilder.andWhere('message.content LIKE :messageText', { messageText: messageTextFilter });
      countQueryBuilder.andWhere('message.content LIKE :messageText', { messageText: messageTextFilter });
    }

    // Get total count (before pagination)
    const total = await countQueryBuilder.getCount();

    // Add ordering and pagination to the main query
    queryBuilder
      .orderBy(`message.${Object.keys(orderBy)[0]}`, Object.values(orderBy)[0])
      .skip(skip)
      .take(limit);

    // Get messages
    const items = await queryBuilder.getMany();

    const result = { items, total };

    // Cache the result (TTL: 30 seconds)
    await this.cacheManager.set(cacheKey, result, 30000);
    this.threadCacheKeys.add(cacheKey);

    this.logger.log(`Fetched thread ${requestId} (User: ${user.id}): ${items.length} messages, total: ${total}`);

    return result;
  }

  /**
   * Generate cache key for thread
   */
  private generateThreadCacheKey(requestId: number, userId: number, query: FindThreadQueryDto): string {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const orderBy = query.orderBy || 'createdAt:asc';
    const messageText = query.messageText ? `:text:${query.messageText.trim()}` : '';
    return `thread:${requestId}:user:${userId}:page:${page}:limit:${limit}:order:${orderBy}${messageText}`;
  }

  /**
   * Clear thread cache for a specific request
   */
  async clearThreadCache(requestId: number): Promise<void> {
    const keysToDelete: string[] = [];
    for (const key of this.threadCacheKeys) {
      if (key.includes(`thread:${requestId}:`)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      await this.cacheManager.del(key);
      this.threadCacheKeys.delete(key);
    }
    
    if (keysToDelete.length > 0) {
      this.logger.log(`Cleared ${keysToDelete.length} cache entries for thread ${requestId}`);
    }
  }

  async markThreadAsRead(requestId: number, user: UserEntity) {
    // Use QueryBuilder for complex WHERE conditions
    await this.messageRepository
      .createQueryBuilder()
      .update(MessageEntity)
      .set({ isRead: true })
      .where('requestId = :requestId', { requestId })
      .andWhere('receiverId = :receiverId', { receiverId: user.id })
      .andWhere('isRead = :isRead', { isRead: false })
      .execute();
    
    // Clear thread cache for this request
    await this.clearThreadCache(requestId);
  }

  async getUnreadCount(user: UserEntity): Promise<number> {
    return this.messageRepository.count({
      where: { receiver: { id: user.id }, isRead: false },
    });
  }

  /**
   * Get unread message counts for multiple requests for a specific user
   * Returns a map of requestId -> unread count
   */
  async getUnreadCountsByRequestIds(requestIds: number[], userId: number): Promise<Map<number, number>> {
    if (requestIds.length === 0) {
      return new Map();
    }

    const results = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.requestId', 'requestId')
      .addSelect('COUNT(message.id)', 'count')
      .where('message.requestId IN (:...requestIds)', { requestIds })
      .andWhere('message.receiverId = :userId', { userId })
      .andWhere('message.isRead = :isRead', { isRead: false })
      .groupBy('message.requestId')
      .getRawMany();

    const unreadCountsMap = new Map<number, number>();
    
    // Initialize all requestIds with 0
    requestIds.forEach(id => unreadCountsMap.set(id, 0));
    
    // Update with actual counts
    results.forEach(result => {
      unreadCountsMap.set(result.requestId, parseInt(result.count, 10));
    });

    return unreadCountsMap;
  }

  async getLatestMessageDatesByRequestIds(requestIds: number[]): Promise<Map<number, Date | null>> {
    if (requestIds.length === 0) {
      return new Map();
    }

    const results = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.requestId', 'requestId')
      .addSelect('MAX(message.createdAt)', 'lastMessageDateTime')
      .where('message.requestId IN (:...requestIds)', { requestIds })
      .andWhere('message.deletedAt IS NULL')
      .groupBy('message.requestId')
      .getRawMany();

    const latestMessageDatesMap = new Map<number, Date | null>();

    requestIds.forEach(id => latestMessageDatesMap.set(id, null));

    results.forEach(result => {
      latestMessageDatesMap.set(
        Number(result.requestId),
        result.lastMessageDateTime ? new Date(result.lastMessageDateTime) : null,
      );
    });

    return latestMessageDatesMap;
  }

  async getMessageById(id: number): Promise<MessageEntity> {
    const message = await this.messageRepository.findOne({
      where: { id },
      relations: ['sender', 'receiver', 'request'],
    });
    
    if (!message) {
      throw new NotFoundException(`Message with ID ${id} not found`);
    }
    
    return message;
  }

  /**
   * Send an inquiry email to a travel or demand creator.
   * No message is persisted in the database.
   */
  async contactAnnouncer(
    sender: UserEntity,
    dto: ContactAnnouncerDto,
  ): Promise<{ success: boolean; message: string }> {
    if (!isValidAnnouncementPublicId(dto.publicId, dto.announcementType)) {
      throw new CustomBadRequestException(
        'Invalid publicId for the given announcement type',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    let owner: UserEntity;
    let departureAirportName: string;
    let arrivalAirportName: string;
    let travelDate: Date | null | undefined;

    try {
      if (dto.announcementType === AnnouncementType.TRAVEL) {
        const travel = await this.travelRepository.findOne({
          where: { publicId: dto.publicId },
          relations: ['user', 'departureAirport', 'arrivalAirport'],
        });

        if (!travel) {
          throw new CustomNotFoundException(
            `Travel with publicId ${dto.publicId} not found`,
            ErrorCode.TRAVEL_NOT_FOUND,
          );
        }

        owner = travel.user;
        departureAirportName = travel.departureAirport?.name ?? 'Unknown';
        arrivalAirportName = travel.arrivalAirport?.name ?? 'Unknown';
        travelDate = travel.travelDate ?? travel.departureDatetime;
      } else {
        const demand = await this.demandRepository.findOne({
          where: { publicId: dto.publicId },
          relations: ['user', 'departureAirport', 'arrivalAirport'],
        });

        if (!demand) {
          throw new CustomNotFoundException(
            `Demand with publicId ${dto.publicId} not found`,
            ErrorCode.DEMAND_NOT_FOUND,
          );
        }

        owner = demand.user;
        departureAirportName = demand.departureAirport?.name ?? 'Unknown';
        arrivalAirportName = demand.arrivalAirport?.name ?? 'Unknown';
        travelDate = demand.travelDate;
      }

      if (!owner?.email) {
        throw new CustomNotFoundException(
          'Could not find owner email for this announcement',
          ErrorCode.USER_NOT_FOUND,
        );
      }

      if (owner.id === sender.id) {
        throw new CustomForbiddenException(
          'You cannot send an inquiry to your own announcement',
          ErrorCode.MESSAGE_UNAUTHORIZED,
        );
      }

      const senderName = this.commonService.userFullName(sender);
      const emailFrom = this.configService.get<string>('EMAIL_FROM');
      const emailHtml = this.emailTemplatesService.getContactAnnouncerTemplate({
        recipientName: this.commonService.userGreetingName(owner),
        senderName,
        announcementType: dto.announcementType,
        message: dto.message,
        departureAirportName,
        arrivalAirportName,
        travelDate,
      });
      const emailText = this.buildAnnouncerInquiryEmailBody(
        dto.message,
        departureAirportName,
        arrivalAirportName,
        travelDate,
      );

      const emailSent = await this.emailService.sendEmail({
        to: owner.email,
        from: emailFrom,
        subject: `You received an inquiry from ${senderName}`,
        html: emailHtml,
        text: emailText,
      });

      if (!emailSent) {
        this.logger.warn(`Failed to send inquiry email to ${owner.email}`);
      } else {
        this.logger.log(
          `Inquiry sent by user #${sender.id} about ${dto.announcementType} ${dto.publicId}, email delivered to ${owner.email}`,
        );
      }

      return {
        success: true,
        message: 'Your message was sent to the announcement creator.',
      };
    } catch (error) {
      this.logger.error(`Error sending announcer inquiry: ${error.message}`, error);
      throw error;
    }
  }

  private buildAnnouncerInquiryEmailBody(
    message: string,
    departureAirportName: string,
    arrivalAirportName: string,
    travelDate: Date | null | undefined,
  ): string {
    const formattedTravelDate = travelDate
      ? new Date(travelDate).toISOString().split('T')[0]
      : 'N/A';

    return `${message}

Departure airport: ${departureAirportName}
Arrival airport: ${arrivalAirportName}
Travel date: ${formattedTravelDate}`;
  }
}

