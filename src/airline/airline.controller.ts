import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { AirlineService } from './airline.service';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { Roles } from 'src/auth/decorators/role.decorators';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { UserRole } from 'src/user/user.entity';
import { FindAirlinesQueryDto } from './dto/FindAirlinesQueryDto';
import { PaginatedAirlinesResponseDto } from './dto/airline-response.dto';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { AirlineEntity } from './entities/airline.entity';

@ApiTags('airlines')
@Controller('airline')
export class AirlineController {
  constructor(private readonly airlineService: AirlineService) {}

  /**
   * Single endpoint to get all airlines with filtering and pagination
   */
  @Get('')
  @ApiOperation({
    summary: 'Get all airlines',
    description: 'Retrieve all airlines with pagination, filtering, and sorting. Admin and operators can access all airlines.'
  })
  @ApiResponse({
    status: 200,
    description: 'Airlines fetched successfully',
    type: PaginatedAirlinesResponseDto // Fix: Use single type, not array
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin or operator access required' })
  async getAllAirlines(
    @Query() query: FindAirlinesQueryDto,
  ): Promise<PaginatedResponse<AirlineEntity>> {
    return this.airlineService.getAllAirlines(query);
  }
}
