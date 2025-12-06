import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserRole } from 'src/user/user.entity';
import { DemandAndTravelService } from './demand-and-travel.service';
import { FindDemandsAndTravelsQueryDto } from './dto/FindDemandsAndTravelsQuery.dto';
import { PaginatedDemandsAndTravelsResponseDto } from './dto/demand-and-travel-response.dto';
import { AirlineResponseDto } from './dto/airlineResponseDto';
import { OptionalJwtAuthGuard } from 'src/auth/guards/optional-jwt-auth.guard';

@ApiTags('demandsAndTravels')
@Controller('demand-and-travel')
export class DemandAndTravelController {
    constructor(private demandAndTravelService: DemandAndTravelService) {}

    @Get()
    @UseGuards(OptionalJwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Get demands and travels with flexible filtering',
        description: `
        Retrieve demands and travels with various filter options:
        - No filters: Returns all demands and travels
        - userId: Returns demands and travels for specific user
        - flightNumber: Returns demands and travels for specific flight
        - originAirportId: Returns demands and travels from specific airport
        - destinationAirportId: Returns demands and travels to specific airport
        - status: Returns demands and travels with specific status
        - type: Filter by type (demand or travel)
        - minWeight/maxWeight: Filter by weight range
        - minPricePerKg/maxPricePerKg: Filter by price range
        - weightAvailable: Search by available weight (travels only)
        - travelDate: Filter by delivery date
        - packageKind: Filter by package kind
        Supports pagination and sorting by createdAt, travelDate, description, flightNumber, pricePerKg, and weight.
        `
    })
    @ApiResponse({ 
        status: 200, 
        description: 'Demands and travels fetched successfully', 
        type: PaginatedDemandsAndTravelsResponseDto 
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin access required for certain operations' })
    async getDemandsAndTravels(
        @Query() query: FindDemandsAndTravelsQueryDto,  
        @CurrentUser() user: any
    ) {
        console.log('User is:', user);
        return await this.demandAndTravelService.getDemandsAndTravels(query, user);
    }


    @Get('airline-from-flight-number')
    @ApiOperation({
        summary: 'Get airline from flight number',
        description: 'Get airline from flight number'
    })
    @ApiResponse({ status: 200, description: 'Airline fetched successfully', type: AirlineResponseDto })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async getAirlineFromFlightNumber(@Query('flightNumber') flightNumber: string) {
        return await this.demandAndTravelService.getAirlineFromFlightNumber(flightNumber);
    }
}
