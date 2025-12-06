import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PlatformPricingService } from './platform-pricing.service';
import { CreatePlatformPricingDto } from './dto/create-platform-pricing.dto';
import { UpdatePlatformPricingDto } from './dto/update-platform-pricing.dto';
import { FindPlatformPricingQueryDto } from './dto/find-platform-pricing-query.dto';
import { PlatformPricingResponseDto } from './dto/platform-pricing-response.dto';
import { PaginatedPlatformPricingResponseDto } from './dto/paginated-platform-pricing-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../user/user.entity';

@ApiTags('Platform Pricing')
@Controller('platform-pricing')
export class PlatformPricingController {
  constructor(private readonly platformPricingService: PlatformPricingService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new platform pricing record',
    description: 'Creates a new pricing tier. Requires admin/operator role. Validates that ranges do not overlap.',
  })
  @ApiResponse({
    status: 201,
    description: 'Platform pricing created successfully',
    type: PlatformPricingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid data or overlapping range' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createPlatformPricingDto: CreatePlatformPricingDto,
  ): Promise<PlatformPricingResponseDto> {
    return this.platformPricingService.create(createPlatformPricingDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all platform pricing records',
    description: 'Returns paginated list of all pricing tiers, ordered by lowerBound.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform pricing records retrieved successfully',
    type: PaginatedPlatformPricingResponseDto,
  })
  async findAll(
    @Query() query: FindPlatformPricingQueryDto,
  ): Promise<PaginatedPlatformPricingResponseDto> {
    return this.platformPricingService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a platform pricing record by ID',
    description: 'Returns a single pricing tier by its ID.',
  })
  @ApiParam({ name: 'id', description: 'Platform pricing ID' })
  @ApiResponse({
    status: 200,
    description: 'Platform pricing retrieved successfully',
    type: PlatformPricingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Platform pricing not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PlatformPricingResponseDto> {
    return this.platformPricingService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update a platform pricing record',
    description: 'Updates a pricing tier. Requires admin/operator role. Validates that updated ranges do not overlap.',
  })
  @ApiParam({ name: 'id', description: 'Platform pricing ID' })
  @ApiResponse({
    status: 200,
    description: 'Platform pricing updated successfully',
    type: PlatformPricingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid data or overlapping range' })
  @ApiResponse({ status: 404, description: 'Platform pricing not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePlatformPricingDto: UpdatePlatformPricingDto,
  ): Promise<PlatformPricingResponseDto> {
    return this.platformPricingService.update(id, updatePlatformPricingDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete a platform pricing record',
    description: 'Deletes a pricing tier. Requires admin/operator role.',
  })
  @ApiParam({ name: 'id', description: 'Platform pricing ID' })
  @ApiResponse({
    status: 200,
    description: 'Platform pricing deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Platform pricing not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.platformPricingService.remove(id);
    return { message: 'Platform pricing deleted successfully' };
  }

  @Get('calculate/:amount')
  @ApiOperation({
    summary: 'Calculate fee and total amount for a given traveler payment',
    description: 'Calculates the platform fee and total amount (including TVA) for a given traveler payment amount.',
  })
  @ApiParam({ name: 'amount', description: 'Traveler payment amount in EUR', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Calculation successful',
    schema: {
      type: 'object',
      properties: {
        travelerPayment: { type: 'number', example: 6 },
        fee: { type: 'number', example: 2 },
        tvaAmount: { type: 'number', example: 0.4 },
        totalAmount: { type: 'number', example: 8.4 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'No pricing tier found for amount' })
  async calculateAmount(
    @Param('amount') amount: string,
  ) {
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber < 0) {
      throw new BadRequestException('Invalid amount. Must be a positive number.');
    }
    return this.platformPricingService.calculateTotalAmount(amountNumber);
  }
}
