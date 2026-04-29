import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  Param,
} from '@nestjs/common';
import { AlertService } from './alert.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AlertResponseDto } from './dto/response/alert-response.dto';
import { CreateAlertDto } from './dto/request/create-alert.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { FindAlertQueryDto } from './dto/request/find-alert.query.dto';
import { PaginatedAlertResponseDto } from './dto/response/paginated-alert-response.dto';

@ApiTags('alerts')
@Controller('alert')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create an alert' })
  @ApiConsumes('application/json')
  @ApiBody({
    type: CreateAlertDto,
    description: 'Create a new alert',
  })
  @ApiResponse({
    status: 201,
    description: 'Alert created successfully',
    type: AlertResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createAlertDto: CreateAlertDto, @CurrentUser() user: any) {
    return this.alertService.create(createAlertDto, user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get alerts with flexible filtering',
    description: `
    Retrieve alerts with various filter options:
    - No filters: Returns all alerts (admin and operators only) or user's alerts (normal users)
    - Normal user: Returns alerts for connected user only
    - Admin/Operator: Returns all alerts
    - alertType: Filter by alert type (DEMAND, TRAVEL, BOTH)
    - flightNumber: Filter by flight number
    - departureAirportId: Filter by departure airport
    - arrivalAirportId: Filter by arrival airport
    - travelDate: Filter by travel date
    
    Supports pagination and sorting by createdAt or travelDate.
    `
  })
  @ApiResponse({ status: 200, description: 'Alerts fetched successfully', type: PaginatedAlertResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAlerts(
    @Query() query: FindAlertQueryDto,
    @CurrentUser() user: any
  ) {
    return this.alertService.findAll(query, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete an alert',
    description: `
    - Admin and operators can delete any alert
    - Normal user: Can only delete their own alerts
    - Soft delete is performed
    `
  })
  @ApiResponse({ status: 200, description: 'Alert deleted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Cannot delete other users alerts' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    await this.alertService.remove(id, user);
    return { message: 'Alert deleted successfully' };
  }
}
