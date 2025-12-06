import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/role.decorators';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { UserRole } from 'src/user/user.entity';
import { UserResponseDto } from 'src/user/dto/user-response.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';

@ApiTags('transactions')
@Controller('transaction')
export class TransactionController {
    constructor(private transactionService:TransactionService){

    }


    @Get('/:id')
    @Roles(UserRole.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Get transaction by id',
    description: 'Retrieve a specific transaction by their ID'
    })
    @ApiParam({ 
        name: 'id', 
        description: 'Transaction ID',
        type: 'number',
        example: 1
      })
      @ApiResponse({ 
        status: 200, 
        description: 'Transaction fetched successfully',
        type: TransactionResponseDto
      })
      @ApiResponse({ status: 404, description: 'User not found' })
    async getTransactionById(@Param('id', ParseIntPipe) id: number,){
       await this.transactionService.getTransactionById(id);
    }
}
