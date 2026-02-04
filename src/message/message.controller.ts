import { 
  Body, 
  Controller, 
  Get, 
  Param, 
  ParseIntPipe, 
  Post, 
  Query,
  UseGuards,
  HttpCode,
  HttpStatus 
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserEntity } from 'src/user/user.entity';
import { SendMessageDto } from './dto/SendMessage.dto';
import { MessageService } from './message.service';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { MessageResponseDto } from './dto/message-response.dto';
import { FindThreadQueryDto } from './dto/request/find-thread-query.dto';
import { PaginatedThreadResponseDto } from './dto/response/paginated-thread-response.dto';
import { MessageMapper } from './message.mapper';
import { SendPublicMessageDto } from './dto/send-public-message.dto';
import { SendPublicMessageResponseDto } from './dto/send-public-message-response.dto';

@ApiTags('messages')
@Controller('message')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    private readonly messageMapper: MessageMapper,
  ) {}

  @Post('send-public')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a public message about a travel or demand',
    description: 'Allow visitors/users to send a message about a travel or demand posting. This is a public endpoint that does not require authentication.',
  })
  @ApiBody({ type: SendPublicMessageDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Message sent successfully',
    type: SendPublicMessageResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid announcement type or data' })
  @ApiResponse({ status: 404, description: 'Travel or Demand not found' })
  async sendPublicMessage(
    @Body() dto: SendPublicMessageDto,
  ): Promise<SendPublicMessageResponseDto> {
    return await this.messageService.sendPublicMessage(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('thread/:requestId')
  @ApiOperation({
    summary: 'Get message thread',
    description: 'Get paginated messages for a specific request with sorting and caching',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Messages fetched successfully',
    type: PaginatedThreadResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getThread(
    @CurrentUser() user: UserEntity,
    @Param('requestId', ParseIntPipe) requestId: number,
    @Query() query: FindThreadQueryDto,
  ): Promise<PaginatedThreadResponseDto> {
    const { items, total } = await this.messageService.getThread(requestId, user, query);
    
    const page = query.page || 1;
    const limit = query.limit || 10;
    const totalPages = Math.ceil(total / limit);
    
    // Map entities to DTOs
    const mappedItems = this.messageMapper.toThreadMessageResponseDtoArray(items);
    
    return {
      items: mappedItems,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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