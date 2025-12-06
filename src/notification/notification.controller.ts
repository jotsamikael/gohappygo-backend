import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto';
import { NotificationResponseDto, NotificationCountResponseDto, PaginatedNotificationsResponseDto } from './dto/notification-response.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';


@ApiTags('Notifications')
@Controller('notification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get current user notifications',
    description: 'Get paginated list of notifications for the authenticated user with optional filters'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Notifications retrieved successfully',
    type: PaginatedNotificationsResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserNotifications(
    @CurrentUser() user: any,
    @Query() query: FindNotificationsQueryDto
  ): Promise<PaginatedNotificationsResponseDto> {
    return this.notificationService.getUserNotifications(user.id, query);
  }

  @Get('counts')
  @ApiOperation({ 
    summary: 'Get notification counts',
    description: 'Get count of unread and total notifications for the authenticated user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Counts retrieved successfully',
    type: NotificationCountResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotificationCounts(
    @CurrentUser() user: any
  ): Promise<NotificationCountResponseDto> {
    return this.notificationService.getNotificationCounts(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ 
    summary: 'Mark notification as read',
    description: 'Mark a single notification as read for the authenticated user'
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Notification marked as read',
    type: NotificationResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your notification' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any
  ): Promise<NotificationResponseDto> {
    return this.notificationService.markAsRead(id, user.id);
  }

  @Patch('mark-all-read')
  @ApiOperation({ 
    summary: 'Mark all notifications as read',
    description: 'Mark all unread notifications as read for the authenticated user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'All notifications marked as read',
    schema: {
      type: 'object',
      properties: {
        affected: { type: 'number', description: 'Number of notifications marked as read' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(
    @CurrentUser() user: any
  ): Promise<{ affected: number }> {
    return this.notificationService.markAllAsRead(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Delete notification',
    description: 'Soft delete a single notification for the authenticated user'
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 204, description: 'Notification deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your notification' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any
  ): Promise<void> {
    return this.notificationService.deleteNotification(id, user.id);
  }

  @Delete('clear-read')
  @ApiOperation({ 
    summary: 'Clear all read notifications',
    description: 'Delete all read notifications for the authenticated user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Read notifications cleared',
    schema: {
      type: 'object',
      properties: {
        affected: { type: 'number', description: 'Number of notifications cleared' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearReadNotifications(
    @CurrentUser() user: any
  ): Promise<{ affected: number }> {
    return this.notificationService.clearReadNotifications(user.id);
  }
}
