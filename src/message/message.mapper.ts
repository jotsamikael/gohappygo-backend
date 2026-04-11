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
  toThreadMessageUserDto(user: any): ThreadMessageUserDto | null {
    if (!user) return null;
    
    return plainToInstance(ThreadMessageUserDto, {
      id: user.id,
      fullName: this.commonService.userFullName(user),
      profilePictureUrl: user.profilePictureUrl || null,
    }, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map MessageEntity to ThreadMessageResponseDto
   */
  toThreadMessageResponseDto(message: MessageEntity): ThreadMessageResponseDto {
    const sender = this.toThreadMessageUserDto(message.sender);
    const receiver = this.toThreadMessageUserDto(message.receiver);

    const mapped = {
      id: message.id,
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