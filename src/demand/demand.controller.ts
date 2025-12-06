import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Patch, Query, UseGuards, UseInterceptors, UploadedFiles, BadRequestException, Delete } from '@nestjs/common';
import { DemandService } from './demand.service';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { CreateDemandDto } from './dto/createDemand.dto';
import { UpdateDemandDto } from './dto/updateDemand.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserRole } from 'src/user/user.entity';
import { FindDemandsQueryDto } from './dto/FindDemandsQuery.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { CreateDemandResponseDto, DemandResponseDto, PaginatedDemandsResponseDto } from './dto/demand-response.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { DemandDetailResponseDto } from './dto/demand-detail-response.dto';
import { DemandEntity } from './demand.entity';

@ApiTags('demands')
@Controller('demand')
export class DemandController {

    constructor(private readonly demandService: DemandService) { }

    @Post()
    @UseGuards(JwtAuthGuard) //must be connected
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'image1', maxCount: 1 },
        { name: 'image2', maxCount: 1 },
        { name: 'image3', maxCount: 1 }  // Add third image
    ]))
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Publish a demand with images' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ 
        type: CreateDemandDto,
        description: 'Demand data with three required images'
    })
    @ApiResponse({ status: 201, description: 'Demand published successfully', type: CreateDemandResponseDto })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async publishDemand(
        @CurrentUser() user: any, 
        @Body() createDemandDto: CreateDemandDto,
        @UploadedFiles() files: { 
            image1?: Express.Multer.File[], 
            image2?: Express.Multer.File[],
            image3?: Express.Multer.File[]  // Add third image
        }
    ) {
        // Validate all three images are uploaded
        if (!files.image1 || !files.image2 || !files.image3 || 
            files.image1.length === 0 || files.image2.length === 0 || files.image3.length === 0) {
            throw new BadRequestException('All three images (image1, image2, and image3) are required');
        }

        const [image1] = files.image1;
        const [image2] = files.image2;
        const [image3] = files.image3;  // Extract third image
        
        return await this.demandService.publishDemand(user, createDemandDto, image1, image2, image3);
    }

     // Single GET endpoint that handles all filtering scenarios
     @Get()
     @UseGuards(JwtAuthGuard)
     @ApiBearerAuth('JWT-auth')
     @ApiOperation({
         summary: 'Get demands with flexible filtering',
         description: `
         Retrieve demands with various filter options:
         - No filters: Returns all demands (admin and operators only)
         - userId: Returns demands for specific user
         - flightNumber: Returns demands for specific flight
         - Departure AirportId: Returns demands from specific airport
         - Arrival AirportId: Returns demands to specific airport
         - Status: Returns demands with specific status
         - Travel Date: Filter by delivery date
         
         Supports pagination and sorting.
         `
     })
     @ApiResponse({ status: 200, description: 'Demands fetched successfully', type: PaginatedDemandsResponseDto })
     @ApiResponse({ status: 400, description: 'Bad request' })
     @ApiResponse({ status: 401, description: 'Unauthorized' })
     @ApiResponse({ status: 403, description: 'Forbidden - Admin access required for certain operations' })
     async getDemands(
         @Query() query: FindDemandsQueryDto,
         @CurrentUser() user: any
     ) {
         // Fix: Check the correct role structure
         const isAdmin = user.role?.code === UserRole.ADMIN;
         const isOperator = user.role?.code === UserRole.OPERATOR;

         
          //Auto-set userId to current user if not admin/operator and no userId specified
         if (!isAdmin && !isOperator && !query.userId) {
             query.userId = user.id;
         }
         
                
         return await this.demandService.getDemands(query);
     }

     @Get(':id')
     @ApiOperation({ summary: 'Get a demand by id' })
     @ApiResponse({ status: 200, description: 'Demand fetched successfully', type: DemandDetailResponseDto })
     @ApiResponse({ status: 400, description: 'Bad request' })
     @ApiResponse({ status: 401, description: 'Unauthorized' })
     @ApiResponse({ status: 404, description: 'Demand not found' })
     async getDemandById(@Param('id', ParseIntPipe) id: number): Promise<DemandDetailResponseDto> {
       return await this.demandService.getDemandById(id);
     }

     @Patch(':id')
     @UseGuards(JwtAuthGuard)
     @ApiBearerAuth('JWT-auth')
     @ApiOperation({ 
         summary: 'Update a demand',
         description: 'Update demand details. Only the demand owner can update their demand. Demand must be active and cannot have accepted, completed, or delivered requests, or paid/refunded transactions.'
     })
     @ApiConsumes('application/json')
     @ApiBody({ 
         type: UpdateDemandDto,
         description: 'Demand update data. All fields are optional.'
     })
     @ApiResponse({ status: 200, description: 'Demand updated successfully', type: DemandResponseDto })
     @ApiResponse({ status: 400, description: 'Bad request - validation failed or demand cannot be updated' })
     @ApiResponse({ status: 401, description: 'Unauthorized' })
     @ApiResponse({ status: 403, description: 'Forbidden - not the demand owner' })
     @ApiResponse({ status: 404, description: 'Demand not found' })
     async updateDemand(
         @Param('id', ParseIntPipe) id: number,
         @Body() updateDemandDto: UpdateDemandDto,
         @CurrentUser() user: any
     ): Promise<DemandEntity> {
         return await this.demandService.updateDemand(id, updateDemandDto, user);
     }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
      summary: 'Delete (cancel) a demand',
      description: 'Soft delete a demand by setting its status to cancelled. Only the demand owner can delete their demand. Demand cannot be deleted if it has accepted, completed, delivered, or negotiating requests, or paid/refunded transactions.'
    })
    @ApiResponse({ 
      status: 200, 
      description: 'Demand deleted (cancelled) successfully',
      type: DemandResponseDto
    })
    @ApiResponse({ 
      status: 400, 
      description: 'Bad request - demand cannot be deleted due to active requests or transactions' 
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - not the demand owner' })
    @ApiResponse({ status: 404, description: 'Demand not found' })
    async deleteDemand(
      @Param('id', ParseIntPipe) id: number,
      @CurrentUser() user: any
    ): Promise<DemandEntity> {
      return await this.demandService.softDeleteDemandByUser(id, user);
    }

   

   


   


  
}
