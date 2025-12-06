import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MessageEntity } from './message.entity';
import { Repository } from 'typeorm';
import { UserService } from 'src/user/user.service';
import { RequestService } from 'src/request/request.service';
import { UserEntity } from 'src/user/user.entity';
import { SendMessageDto } from './dto/SendMessage.dto';

@Injectable()
export class MessageService {

    constructor(@InjectRepository(MessageEntity) private messageRepository: Repository<MessageEntity>,
    private userService: UserService, private   requestService: RequestService){}

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
    return this.messageRepository.save(message);
  }

  async getThread(requestId: number, user: UserEntity): Promise<MessageEntity[]> {
    // Optionally, check if user is part of the request
    return this.messageRepository.find({
      where: { request: { id: requestId } },
      relations: ['sender', 'receiver'],
      order: { createdAt: 'ASC' },
    });
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

