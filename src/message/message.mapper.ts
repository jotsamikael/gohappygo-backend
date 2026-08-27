import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { MessageEntity } from "./message.entity";
import { ThreadMessageResponseDto, ThreadMessageUserDto } from "./dto/response/thread-message-response.dto";
import { CommonService } from "src/common/service/common.service";

@Injectable()
export class MessageMapper {
  constructor(private readonly commonService: CommonService) {}

  /**
   * Map UserEntity to ThreadMessageUserDto
   */
  toThreadMessageUserDto(user: any, userId?: number): ThreadMessageUserDto | null {
    const publicUser = this.commonService.publicUserOrDeletedPlaceholder(user, userId);
    if (!publicUser) return null;
    
    return plainToInstance(ThreadMessageUserDto, publicUser, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map MessageEntity to ThreadMessageResponseDto
   */
  toThreadMessageResponseDto(message: MessageEntity): ThreadMessageResponseDto {
    const sender = this.toThreadMessageUserDto(message.sender, (message as any).senderId);
    const receiver = this.toThreadMessageUserDto(message.receiver, (message as any).receiverId);

    const mapped = {
      id: message.id,
      publicId: message.publicId,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender,
      receiver,
    };

    return plainToInstance(ThreadMessageResponseDto, mapped, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map array of MessageEntity to array of ThreadMessageResponseDto
   */
  toThreadMessageResponseDtoArray(messages: MessageEntity[]): ThreadMessageResponseDto[] {
    return messages.map(message => this.toThreadMessageResponseDto(message));
  }
}