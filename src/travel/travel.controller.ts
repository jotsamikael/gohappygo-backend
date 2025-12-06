import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Patch, Query, UseGuards, UseInterceptors, UploadedFiles, BadRequestException, Delete } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { Roles } from 'src/auth/decorators/role.decorators';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { UserRole } from 'src/user/user.entity';
import { TravelService } from './travel.service';
import { FindTravelsQueryDto } from './dto/findTravelsQuery.dto';
import { CreateTravelDto } from './dto/createTravel.dto';
import { UpdateTravelDto } from './dto/updateTravel.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { CreateTravelResponseDto, TravelResponseDto } from './dto/travel-response.dto';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { TravelEntity } from './travel.entity';
import { TravelDetailResponseDto } from './dto/travel-detail.response.dto';

@ApiTags('travels')
@Controller('travel')
export class TravelController {

    constructor(private readonly travelService: TravelService){}
    
    @Post()
    @UseGuards(JwtAuthGuard) //must be connected
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'image1', maxCount: 1 },
        { name: 'image2', maxCount: 1 }
    ]))
    @ApiBearerAuth('JWT-auth') 
    @ApiOperation({ summary: 'Publish a travel with images' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ 
        type: CreateTravelDto,
        description: 'Travel data with two required images'
    })
    @ApiResponse({ status: 201, description: 'Travel published successfully',type: CreateTravelResponseDto })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async publishTravel(
        @CurrentUser() user: any, 
        @Body() createTravelDto: CreateTravelDto,
        @UploadedFiles() files: { image1?: Express.Multer.File[], image2?: Express.Multer.File[] }
    ){
          // Basic validation - check that both files are uploaded
          if (!files.image1 || !files.image2 || files.image1.length === 0 || files.image2.length === 0) {
            throw new BadRequestException('Both image1 and image2 are required');
        }

        const [image1] = files.image1;
        const [image2] = files.image2;
        
        return await this.travelService.publishTravel(user, createTravelDto, image1, image2);
    }

    

        // Single GET endpoint that handles all filtering scenarios

        @Get('')
        @UseGuards(JwtAuthGuard) //guards the endpoint
        @ApiBearerAuth('JWT-auth') 
        @ApiOperation({ summary: 'Get all travels',
            description: `
            Retrieve travels with various filter options:
         - No filters: Returns all travels (admin and operators only)
         - userId: Returns travels for specific user
         - flightNumber: Returns travels for specific flight
         - originAirportId: Returns travels from specific airport
         - destinationAirportId: Returns travels to specific airport
         - status: Returns travels with specific status
         - title: Search travels by title
         - weightAvailable: Serach by available weight
         - deliveryDate: Filter by delivery date
         
         Supports pagination and sorting.
            `
         })
        @ApiResponse({ status: 200, description: 'Travels fetched successfully',type: TravelResponseDto })
        @ApiResponse({ status: 400, description: 'Bad request' })
        @ApiResponse({ status: 401, description: 'Unauthorized' })
        @ApiResponse({ status: 403, description: 'Forbidden - Admin access required for certain operations' })

        async getAll(@Query() query: FindTravelsQueryDto, @CurrentUser() user: any){
           // Fix: Check the correct role structure
         const isAdmin = user.role?.code === UserRole.ADMIN;
         const isOperator = user.role?.code === UserRole.OPERATOR;

         
          //Auto-set userId to current user if not admin/operator and no userId specified
         if (!isAdmin && !isOperator && !query.userId) {
             query.userId = user.id;
         }
         
           
        return await this.travelService.getAllTravels(query);
        }


        @Get(':id')
        @ApiOperation({
            summary: 'Get a travel by ID',
            description: 'Retrieve a travel by its ID',
        })
        @ApiResponse({ status: 200, description: 'Travel fetched successfully', type: TravelDetailResponseDto })
        @ApiResponse({ status: 401, description: 'Unauthorized' })
        @ApiResponse({ status: 404, description: 'Travel not found' })
        findOne(@Param('id', ParseIntPipe) id: number): Promise<TravelDetailResponseDto> {
            return this.travelService.getTravelDetail(id);
        }

        @Patch(':id')
        @UseGuards(JwtAuthGuard)
        @ApiBearerAuth('JWT-auth')
        @ApiOperation({ 
            summary: 'Update a travel',
            description: 'Update travel details. Only the travel owner can update their travel. Travel must be active and cannot have accepted, completed, or delivered requests, or paid/refunded transactions.'
        })
        @ApiConsumes('application/json')
        @ApiBody({ 
            type: UpdateTravelDto,
            description: 'Travel update data. All fields are optional.'
        })
        @ApiResponse({ status: 200, description: 'Travel updated successfully', type: TravelResponseDto })
        @ApiResponse({ status: 400, description: 'Bad request - validation failed or travel cannot be updated' })
        @ApiResponse({ status: 401, description: 'Unauthorized' })
        @ApiResponse({ status: 403, description: 'Forbidden - not the travel owner' })
        @ApiResponse({ status: 404, description: 'Travel not found' })
        async updateTravel(
            @Param('id', ParseIntPipe) id: number,
            @Body() updateTravelDto: UpdateTravelDto,
            @CurrentUser() user: any
        ): Promise<TravelEntity> {
            return await this.travelService.updateTravel(id, updateTravelDto, user);
        }

        @Delete(':id')
        @UseGuards(JwtAuthGuard)
        @ApiBearerAuth('JWT-auth')
        @ApiOperation({ 
            summary: 'Delete (cancel) a travel',
            description: 'Soft delete a travel by setting its status to cancelled. Only the travel owner can delete their travel. Travel cannot be deleted if it has accepted, completed, delivered, or negotiating requests, or paid/refunded transactions.'
        })
        @ApiResponse({ status: 200, description: 'Travel deleted (cancelled) successfully', type: TravelResponseDto })
        @ApiResponse({ status: 400, description: 'Bad request - travel cannot be deleted due to active requests or transactions' })
        @ApiResponse({ status: 401, description: 'Unauthorized' })
        @ApiResponse({ status: 403, description: 'Forbidden - not the travel owner' })
        @ApiResponse({ status: 404, description: 'Travel not found' })
        async deleteTravel(
            @Param('id', ParseIntPipe) id: number,
            @CurrentUser() user: any
        ): Promise<TravelEntity> {
            return await this.travelService.softDeleteTravel(id, user);
        }
    }
