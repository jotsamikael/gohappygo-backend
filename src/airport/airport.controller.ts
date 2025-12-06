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
  @ApiBearerAuth('JWT-auth') 
  @ApiOperation({ summary: 'Create an airport' })
  @ApiBody({ type: CreateAirportDto })
  @ApiResponse({ status: 201, description: 'Airport created successfully',type: AirportResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createAirportDto: CreateAirportDto) {
    return this.airportService.create(createAirportDto);
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

 

  @Patch(':id')
  @ApiBearerAuth('JWT-auth') 
  @ApiOperation({ summary: 'Update an airport' })
  @ApiBody({ type: UpdateAirportDto })
  @ApiResponse({ status: 200, description: 'Airport updated successfully', type: AirportResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateAirportDto: UpdateAirportDto) {
    return this.airportService.update(id, updateAirportDto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth') 
  @ApiOperation({ summary: 'Delete an airport' })
  @ApiResponse({ status: 200, description: 'Airport deleted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.airportService.remove(id);
  }
}
