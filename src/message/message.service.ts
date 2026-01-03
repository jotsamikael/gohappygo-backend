import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MessageEntity } from './message.entity';
import { Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';
import { RequestService } from 'src/request/request.service';
import { UserEntity } from 'src/user/user.entity';
import { SendMessageDto } from './dto/SendMessage.dto';
import { FindThreadQueryDto } from './dto/request/find-thread-query.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);
  private threadCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(MessageEntity) private messageRepository: Repository<MessageEntity>,
    private userService: UserService,
    private requestService: RequestService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async sendMessage(sender: UserEntity, dto: SendMessageDto): Promise<MessageEntity> {
    const request = await this.requestService.findOne({ id: dto.requestId });
    const receiver = await this.userService.findOne({ id: dto.receiverId });
    if (!request || !receiver) throw new NotFoundException('Request or receiver not found');

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
}

