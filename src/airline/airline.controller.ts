import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AirlineService } from './airline.service';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { UpdateAirlineDto } from './dto/update-airline.dto';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { Roles } from 'src/auth/decorators/role.decorators';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { UserRole } from 'src/user/user.entity';
import { FindAirlinesQueryDto } from './dto/FindAirlinesQueryDto';
import { PaginatedAirlinesResponseDto } from './dto/airline-response.dto';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { AirlineEntity } from './entities/airline.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from 'src/file-upload/cloudinary/cloudinary.service';
import { extname } from 'path';

@ApiTags('airlines')
@Controller('airline')
export class AirlineController {
  constructor(
    private readonly airlineService: AirlineService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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
    type: PaginatedAirlinesResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin or operator access required' })
  async getAllAirlines(
    @Query() query: FindAirlinesQueryDto,
  ): Promise<PaginatedResponse<AirlineEntity>> {
    return this.airlineService.getAllAirlines(query);
  }

  /**
   * Toggle activation status of an airline (admin/operator only).
   * If the airline is currently active it will be deactivated, and vice versa.
   * PATCH /airline/:id/toggle-activation
   */
  @Patch(':id/toggle-activation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Toggle activation status of an airline (Admin/Operator only)',
    description: 'Toggles the `isDeactivated` flag on an airline. If the airline is currently active it will be deactivated (hidden from regular users), and if it is deactivated it will be re-activated (visible to regular users). Admins/operators can see all airlines regardless of status.'
  })
  @ApiParam({ name: 'id', type: Number, description: 'Airline ID' })
  @ApiResponse({ status: 200, description: 'Airline activation status toggled successfully', type: AirlineEntity })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Operator access only' })
  @ApiResponse({ status: 404, description: 'Airline not found' })
  toggleActivation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ): Promise<AirlineEntity> {
    return this.airlineService.toggleActivation(id, user);
  }

   @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.OPERATOR)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
      summary: 'Create a new airline',
      description: 'Admin or operator - Create a new airline in the system. Supports optional logo upload.'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
      schema: {
        type: 'object',
        required: ['icaoCode', 'name'],
        properties: {
          icaoCode: { type: 'string', description: 'ICAO code (3-4 letters)', example: 'AFR' },
          iataCode: { type: 'string', description: 'IATA code (2 letters)', example: 'AF' },
          name: { type: 'string', description: 'Airline name', example: 'Air France' },
          prefix: { type: 'string', description: 'Airline prefix', example: 'AFR' },
          fleetSize: { type: 'number', description: 'Fleet size', example: 250 },
          destinationsCount: { type: 'number', description: 'Number of destinations', example: 200 },
          callsign: { type: 'string', description: 'Callsign', example: 'AIRFRANS' },
          wikipediaUrl: { type: 'string', description: 'Wikipedia URL', example: 'https://en.wikipedia.org/wiki/Air_France' },
          logo: { type: 'string', format: 'binary', description: 'Airline logo image file' },
        },
      },
    })
    @UseInterceptors(FileInterceptor('logo'))
    @ApiResponse({ status: 201, description: 'Airline created successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin or operator access required' })
    @ApiResponse({ status: 409, description: 'Airline code already exists' })
    create(
      @CurrentUser() user: any,
      @Body() createAirlineDto: CreateAirlineDto,
      @UploadedFile() logo?: Express.Multer.File,
    ) {
      return this.airlineService.createAirline(createAirlineDto, user, logo);
    }


    @Patch(':id')
      @UseGuards(JwtAuthGuard, RolesGuard)
      @Roles(UserRole.ADMIN, UserRole.OPERATOR)
      @ApiBearerAuth('JWT-auth')
      @ApiOperation({ 
        summary: 'Update an airline',
        description: 'Admin or operator - Update an existing airline. Supports optional logo replacement.'
      })
      @ApiConsumes('multipart/form-data')
      @ApiBody({
        schema: {
          type: 'object',
          properties: {
            icaoCode: { type: 'string', description: 'ICAO code (3-4 letters)', example: 'AFR' },
            iataCode: { type: 'string', description: 'IATA code (2 letters)', example: 'AF' },
            name: { type: 'string', description: 'Airline name', example: 'Air France' },
            prefix: { type: 'string', description: 'Airline prefix', example: 'AFR' },
            fleetSize: { type: 'number', description: 'Fleet size', example: 250 },
            destinationsCount: { type: 'number', description: 'Number of destinations', example: 200 },
            callsign: { type: 'string', description: 'Callsign', example: 'AIRFRANS' },
            wikipediaUrl: { type: 'string', description: 'Wikipedia URL', example: 'https://en.wikipedia.org/wiki/Air_France' },
            logo: { type: 'string', format: 'binary', description: 'Airline logo image file (replaces existing logo)' },
          },
        },
      })
      @UseInterceptors(FileInterceptor('logo'))
      @ApiResponse({ status: 200, description: 'Airline updated successfully' })
      @ApiResponse({ status: 400, description: 'Bad request' })
      @ApiResponse({ status: 401, description: 'Unauthorized' })
      @ApiResponse({ status: 403, description: 'Forbidden - Admin or operator access required' })
      @ApiResponse({ status: 404, description: 'Airline not found' })
      @ApiResponse({ status: 409, description: 'Airline already exists' })
      update(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any,
        @Body() updateAirlineDto: UpdateAirlineDto,
        @UploadedFile() logo?: Express.Multer.File,
      ) {
        return this.airlineService.updateAirline(id, updateAirlineDto, user, logo);
      }
    
      @Delete(':id')
      @UseGuards(JwtAuthGuard, RolesGuard)
      @Roles(UserRole.ADMIN)
      @ApiBearerAuth('JWT-auth')
      @ApiOperation({ 
        summary: 'Delete an airline',
        description: 'Admin only - Soft delete a currency'
      })
      @ApiResponse({ status: 200, description: 'Airline deleted successfully' })
      @ApiResponse({ status: 401, description: 'Unauthorized' })
      @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
      @ApiResponse({ status: 404, description: 'Airline not found' })
      remove(@Param('id', ParseIntPipe) id: number) {
        return this.airlineService.deleteAirline(id);
      }
}
