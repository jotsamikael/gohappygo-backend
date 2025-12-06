import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { RequestService } from './request.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateRequestToTravelDto } from './dto/createRequestToTravel.dto';
import { FindRequestsQueryDto } from './dto/findRequestsQuery.dto';
import { UserEntity, UserRole } from 'src/user/user.entity';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { CreateRequestResponseDto, PaginatedRequestsResponseDto, RequestResponseDto } from './dto/request-response.dto';
import { RequestAcceptResponseDto } from './dto/request-accept-response.dto';


@ApiTags('requests')
@Controller('request')
export class RequestController {

  constructor(private requestService: RequestService) { }

  @Post('to-travel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth') 
  @ApiOperation({ summary: 'Create a request to travel with payment card details' })
  @ApiConsumes('application/json')
  @ApiBody({ 
    type: CreateRequestToTravelDto,
    description: 'Request data with travelId, requestType, weight, and payment card details (cardNumber, expiryDate, cvc)'
  })
  @ApiResponse({ status: 201, description: 'Request to travel created successfully',type: CreateRequestResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createRequestToTravel(
    @CurrentUser() user: any, 
    @Body() createRequestDto: CreateRequestToTravelDto
  ) {
    return this.requestService.createRequestToTravel(createRequestDto, user);
  }



  // Unified GET endpoint that handles all filtering scenarios
  @Get('')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get requests with flexible filtering',
    description: `
    Retrieve requests with various filter options:
    - No filters: Returns requests based on user role
    - Regular users: See requests they created + requests linked to their travels/demands
    - Admin/Operators: See all requests + can filter by specific user
    - id: Get specific request by ID
    - requesterId: Filter by requester (admin only)
    - travelId: Filter by travel ID
    - demandId: Filter by demand ID
    - requestType: Filter by request type (GoAndGive/GoAndGo)
    - packageDescription: Search by package description
    - weight: Filter by weight
    - limitDate: Filter by limit date
    - status: Filter by current status
    
    Supports pagination and sorting.
    `
  })
  @ApiResponse({ status: 200, description: 'Requests fetched successfully', type: PaginatedRequestsResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required for certain operations' })
  async getAllRequests(
    @Query() query: FindRequestsQueryDto,
    @CurrentUser() user: UserEntity
  ) {
       // Fix: Check the correct role structure
       const isAdmin = user.role?.code === UserRole.ADMIN;
       const isOperator = user.role?.code === UserRole.OPERATOR;
       
        //Auto-set requesterId to current user if not admin/operator and no requesterId specified
       if (!isAdmin && !isOperator && !query.requesterId) {
           query.requesterId = user.id;
       }
    return await this.requestService.getAllRequests(query, user);
  }

  

  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth') 
  @ApiOperation({ summary: 'Connected user can accept a request' })
  @ApiResponse({ status: 200, description: 'Request accepted successfully', type: RequestAcceptResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - not authorized to accept this request' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async acceptRequest(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserEntity
  ): Promise<RequestAcceptResponseDto> {
    return this.requestService.acceptRequest(id, user);
  }


  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth') 
  @ApiOperation({ summary: 'Complete a request' })
  @ApiResponse({ status: 200, description: 'Request completed successfully',type: RequestResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async completeRequest(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: UserEntity) {
    return this.requestService.completeRequest(id, user);
  }
}
