import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { AirportService } from './airport.service';
import { CreateAirportDto } from './dto/create-airport.dto';
import { UpdateAirportDto } from './dto/update-airport.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AirportResponseDto } from './dto/airport-response.dto';
import { FindAirportsQueryDto } from './dto/find-airports-query.dto';
import { Roles } from 'src/auth/decorators/role.decorators';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { UserRole } from 'src/user/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';

@ApiTags('airports')
@Controller('airports')
export class AirportController {
  constructor(private readonly airportService: AirportService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create an airport',
    description: 'Admin or operator — create a new airport in the system.',
  })
  @ApiBody({ type: CreateAirportDto })
  @ApiResponse({ status: 201, description: 'Airport created successfully', type: AirportResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin or operator access required' })
  @ApiResponse({ status: 409, description: 'Airport already exists' })
  create(
    @CurrentUser() user: any,
    @Body() createAirportDto: CreateAirportDto,
  ) {
    return this.airportService.create(createAirportDto, user);
  }

  /**Single endpoint to get all airports with filtering and pagination */
  @Get()
  @ApiOperation({ summary: 'Get all airports with flexible filtering', 
    description: `
    Retrieve airports with various filter options:
    - No filters: Returns all airports (admin and operators only)
    - name: Returns airports with specific name
    - city: Returns airports in specific city
    - country: Returns airports in specific country
    - code: Returns airports with specific code
    `
   })
  @ApiResponse({ status: 200, description: 'Airports fetched successfully', type: AirportResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required for certain operations' })
  findAll(
    @Query() query: FindAirportsQueryDto,
  ) {
    return this.airportService.getAllAirports(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an airport by ID', 
    description: 'Retrieve a single airport by its unique identifier'
   })
  @ApiResponse({ status: 200, description: 'Airport fetched successfully', type: AirportResponseDto })
  @ApiResponse({ status: 404, description: 'Airport not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.airportService.findOne(id);
  }

 

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update an airport',
    description: 'Admin or operator — update an existing airport.',
  })
  @ApiBody({ type: UpdateAirportDto })
  @ApiResponse({ status: 200, description: 'Airport updated successfully', type: AirportResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin or operator access required' })
  @ApiResponse({ status: 404, description: 'Airport not found' })
  @ApiResponse({ status: 409, description: 'Airport already exists' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Body() updateAirportDto: UpdateAirportDto,
  ) {
    return this.airportService.update(id, updateAirportDto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete an airport',
    description: 'Admin only — permanently delete an airport.',
  })
  @ApiResponse({ status: 200, description: 'Airport deleted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Airport not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.airportService.remove(id);
  }

  /**
   * Toggle activation status of an airport (admin/operator only).
   * If the airport is currently active it will be deactivated, and vice versa.
   * PATCH /airports/:id/toggle-activation
   */
  @Patch(':id/toggle-activation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Toggle activation status of an airport (Admin/Operator only)',
    description: 'Toggles the `isDeactivated` flag on an airport. If the airport is currently active it will be deactivated (hidden from regular users), and if it is deactivated it will be re-activated (visible to regular users). Admins/operators can see all airports regardless of status.'
  })
  @ApiResponse({ status: 200, description: 'Airport activation status toggled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Operator access only' })
  @ApiResponse({ status: 404, description: 'Airport not found' })
  toggleActivation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.airportService.toggleActivation(id, user);
  }



  
}
