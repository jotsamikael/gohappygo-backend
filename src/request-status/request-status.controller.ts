import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { RequestStatusService } from './request-status.service';
import { RequestStatusEntity } from './requestStatus.entity';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/role.decorators';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { UserRole } from 'src/user/user.entity';
import { RequestStatusResponseDto } from './dto/requestStatusResponse.dto';

@Controller('request-status')
export class RequestStatusController {
    constructor(private readonly requestStatusService: RequestStatusService) {}

    /*@Get()
    @Roles(UserRole.ADMIN)//sets the required role to acces endpoint
    @UseGuards(JwtAuthGuard, RolesGuard) //guards the endpoint
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get all request statuses' })
    @ApiResponse({ status: 200, description: 'Request statuses fetched successfully', type: [RequestStatusResponseDto] })
    async getRequestStatuses() {
        return this.requestStatusService.getRequestStatuses();
    }

    @Get(':status')
    async getRequestStatus(@Param('status') status: string) {
        return this.requestStatusService.getRequestByStatus(status);
    }*/

   
    
}
