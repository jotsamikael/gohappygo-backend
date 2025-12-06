import { 
  Body, 
  Controller, 
  Get, 
  Param, 
  ParseIntPipe, 
  Post, 
  UseGuards 
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserEntity } from 'src/user/user.entity';
import { SendMessageDto } from './dto/SendMessage.dto';
import { MessageService } from './message.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessageResponseDto } from './dto/message-response.dto';

@ApiTags('messages')
@Controller('message')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('send')
  @ApiOperation({
    summary: 'Send a message (REST fallback)',
    description: 'Send a message via REST API (alternative to WebSocket)',
  })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sendMessage(
    @CurrentUser() user: UserEntity,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.messageService.sendMessage(user, dto);
    return {
      success: true,
      message,
    };
  }

  @Get('thread/:requestId')
  @ApiOperation({
    summary: 'Get message thread',
    description: 'Get all messages for a specific request',
  })
  @ApiResponse({ status: 200, description: 'Messages fetched successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getThread(
    @CurrentUser() user: UserEntity,
    @Param('requestId', ParseIntPipe) requestId: number,
  ) {
    const messages = await this.messageService.getThread(requestId, user);
    return {
      success: true,
      requestId,
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
        sender: {
          id: msg.sender.id,
          firstName: msg.sender.firstName,
          lastName: msg.sender.lastName,
          profilePictureUrl: msg.sender.profilePictureUrl,
        },
        receiver: {
          id: msg.receiver.id,
          firstName: msg.receiver.firstName,
          lastName: msg.receiver.lastName,
        },
      })),
    };
  }

  @Post('thread/:requestId/mark-read')
  @ApiOperation({
    summary: 'Mark thread as read',
    description: 'Mark all messages in a thread as read',
  })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markThreadAsRead(
    @CurrentUser() user: UserEntity,
    @Param('requestId', ParseIntPipe) requestId: number,
  ) {
    await this.messageService.markThreadAsRead(requestId, user);
    return {
      success: true,
      message: 'Thread marked as read',
    };
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread message count',
    description: 'Get the total number of unread messages for the current user',
  })
  @ApiResponse({ status: 200, description: 'Unread count fetched successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@CurrentUser() user: UserEntity) {
    const count = await this.messageService.getUnreadCount(user);
    return {
      success: true,
      unreadCount: count,
    };
  }
}