import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { SupportService } from './support.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { FindSupportRequestsQueryDto } from './dto/find-support-requests-query.dto';
import { RespondSupportRequestDto } from './dto/respond-support-request.dto';
import { SupportRequestResponseDto } from './dto/support-request-response.dto';
import { PaginatedSupportRequestsResponseDto } from './dto/paginated-support-requests-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { UserEntity } from '../user/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';

@ApiTags('Supports')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a new support request',
    description: 'Allows visitors and users to submit support requests. Sends confirmation email to requester and notification to support team.',
  })
  @ApiBody({
    type: CreateSupportRequestDto,
    description: 'Support request data',
  })
  @ApiResponse({
    status: 201,
    description: 'Support request created successfully',
    type: SupportRequestResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async createSupportRequest(
    @Body() createDto: CreateSupportRequestDto,
  ): Promise<SupportRequestResponseDto> {
    return this.supportService.createSupportRequest(createDto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all support requests',
    description: 'List support requests with filtering and pagination. Non-admin/operator users can only see their own requests.',
  })
  @ApiResponse({
    status: 200,
    description: 'Support requests retrieved successfully',
    type: PaginatedSupportRequestsResponseDto,
  })
  async getSupportRequests(
    @Query() query: FindSupportRequestsQueryDto,
    @CurrentUser() user: any,
  ): Promise<PaginatedSupportRequestsResponseDto> {
    console.log('user', user);
    return this.supportService.getSupportRequests(query, user);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get a support request by ID',
    description: 'Retrieve a single support request with all its logs. Non-admin/operator users can only view their own requests.',
  })
  @ApiParam({ name: 'id', description: 'Support request ID' })
  @ApiResponse({
    status: 200,
    description: 'Support request retrieved successfully',
    type: SupportRequestResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Support request not found' })
  @ApiResponse({ status: 403, description: 'Unauthorized to view this request' })
  async getSupportRequestById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user?: any,
  ): Promise<SupportRequestResponseDto> {
    return this.supportService.getSupportRequestById(id, user);
  }

  @Post(':id/respond')
  @ApiBearerAuth('JWT-auth') 
  @UseGuards(JwtAuthGuard) 
  @ApiOperation({
    summary: 'Operator responds to support request',
    description: 'Allows operators/admins to respond to support requests. Creates a log entry and sends email to requester.',
  })
  @ApiParam({ name: 'id', description: 'Support request ID' })
  @ApiResponse({
    status: 200,
    description: 'Response added successfully',
    type: SupportRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Only operators/admins can respond' })
  @ApiResponse({ status: 404, description: 'Support request not found' })
  @ApiResponse({ status: 400, description: 'Cannot respond to closed request' })
  async respondToSupportRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() respondDto: RespondSupportRequestDto,
    @CurrentUser() operator: any,
  ): Promise<SupportRequestResponseDto> {
    return this.supportService.respondToSupportRequest(id, respondDto, operator);
  }

  @Post(':id/reply')
  @ApiBearerAuth('JWT-auth') 
  @UseGuards(JwtAuthGuard) 
  @ApiOperation({
    summary: 'User/visitor replies to support request',
    description: 'Allows users/visitors to reply to operator responses. Creates a log entry and sends email to support team.',
  })
  @ApiParam({ name: 'id', description: 'Support request ID' })
  @ApiResponse({
    status: 200,
    description: 'Reply added successfully',
    type: SupportRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Unauthorized to reply to this request' })
  @ApiResponse({ status: 404, description: 'Support request not found' })
  @ApiResponse({ status: 400, description: 'Cannot reply to closed request' })
  async replyToSupportRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() respondDto: RespondSupportRequestDto,
    @CurrentUser() user?: any,
  ): Promise<SupportRequestResponseDto> {
    return this.supportService.replyToSupportRequest(id, respondDto, user);
  }

  @Patch(':id/close')
  @ApiBearerAuth('JWT-auth') 
  @UseGuards(JwtAuthGuard) 
  @ApiOperation({
    summary: 'Close a support request',
    description: 'Allows operators/admins to close/resolve a support request. Sends notification email to requester.',
  })
  @ApiParam({ name: 'id', description: 'Support request ID' })
  @ApiResponse({
    status: 200,
    description: 'Support request closed successfully',
    type: SupportRequestResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Only operators/admins can close requests' })
  @ApiResponse({ status: 404, description: 'Support request not found' })
  @ApiResponse({ status: 400, description: 'Request is already closed' })
  async closeSupportRequest(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() operator: any,
  ): Promise<SupportRequestResponseDto> {
    return this.supportService.closeSupportRequest(id, operator);
  }
}
