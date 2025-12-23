import { Controller, Get, Param, ParseIntPipe, Query, UseGuards, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserEntity } from 'src/user/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { FindTransactionQueryDto } from './dto/request/find-transaction-requests-query.dto';
import { PaginatedTransactionResponseDto } from './dto/response/paginated-transaction-response.dto';

@ApiTags('transactions')
@Controller('transaction')
export class TransactionController {
    constructor(private transactionService: TransactionService) {}

    @Get('')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Get transactions with flexible filtering',
        description: `
        Retrieve transactions with various filter options:
        - No filters: Returns transactions based on user role
        - Regular users: See transactions they are either payer or payee
        - Admin/Operators: See all transactions + can filter by specific user
        - id: Get specific transaction by ID
        - payerId: Filter by payer (admin only)
        - payeeId: Filter by payee (admin only)
        - requestId: Filter by request (admin only)
        - minAmount: Filter by minimum amount
        - maxAmount: Filter by maximum amount
        - date: Filter by date
        - status: Filter by transaction status
        
        Supports pagination and sorting.
        `
    })
    @ApiResponse({ 
        status: 200, 
        description: 'Transactions fetched successfully',
        type: PaginatedTransactionResponseDto
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Admin only filter used' })
    async getAllTransactions(
        @Query() query: FindTransactionQueryDto,
        @CurrentUser() user: UserEntity,
    ): Promise<PaginatedTransactionResponseDto> {
        return this.transactionService.findAll(query, user);
    }

    @Post(':id/release-funds')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Release funds to payee',
        description: 'Release funds from Stripe to the payee. Transaction must have status "paid" and payee must have completed Stripe onboarding.'
    })
    @ApiParam({
        name: 'id',
        description: 'Transaction ID',
        type: Number,
    })
    @ApiResponse({ 
        status: 200, 
        description: 'Funds released successfully',
    })
    @ApiResponse({ status: 400, description: 'Bad request - Transaction not in paid status or payee onboarding incomplete' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Only payer can release funds' })
    @ApiResponse({ status: 404, description: 'Transaction not found' })
    async releaseFunds(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: UserEntity,
    ): Promise<{ message: string }> {
        await this.transactionService.releaseFundsFromStripe(id, user);
        return { message: 'Funds released successfully' };
    }

    @Get('balance')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Get Stripe account balance for current user',
        description: 'Returns available and pending balance from Stripe Connect account'
    })
    @ApiResponse({ 
        status: 200, 
        description: 'Balance retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                available: { type: 'number', example: 100.50 },
                pending: { type: 'number', example: 50.25 },
                currency: { type: 'string', example: 'usd' },
            }
        }
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getBalance(
        @CurrentUser() user: UserEntity,
    ): Promise<{ available: number; pending: number; currency: string }> {
        return this.transactionService.getUserBalance(user);
    }
}
