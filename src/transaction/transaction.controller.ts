import { Controller, Get, Param, ParseIntPipe, Query, UseGuards, Post, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserEntity } from 'src/user/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { FindTransactionQueryDto } from './dto/request/find-transaction-requests-query.dto';
import { PaginatedTransactionResponseDto } from './dto/response/paginated-transaction-response.dto';
import { RequestPayoutDto } from './dto/request/request-payout.dto';
import { PayoutResponseDto } from './dto/response/payout-response.dto';

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
        description: 'Release funds from Stripe to the payee. This endpoint serves as a fallback to retry fund transfer when automatic release fails (e.g., payee onboarding incomplete). ' +
                     'Can be called by either the payer (during request completion) or the payee (to retry after completing onboarding). ' +
                     'Transaction must have status "paid" or "awaiting_transfer" and payee must have completed Stripe onboarding.'
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
    @ApiResponse({ status: 400, description: 'Bad request - Transaction not in paid/awaiting_transfer status or payee onboarding incomplete' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Forbidden - Only payer or payee can release funds' })
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

    @Post('payout')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Request payout to bank account',
        description: 'Withdraw funds from your Stripe Connect account balance to your configured bank account. ' +
                     'Requires a Stripe Connect account with a bank account configured. ' +
                     'Funds will be transferred to your external bank account according to Stripe\'s payout schedule (typically 2-7 business days).'
    })
    @ApiResponse({ 
        status: 200, 
        description: 'Payout requested successfully',
        type: PayoutResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Bad request - Insufficient balance, missing bank account, or invalid amount' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async requestPayout(
        @CurrentUser() user: UserEntity,
        @Body() requestPayoutDto: RequestPayoutDto,
    ): Promise<PayoutResponseDto> {
        return this.transactionService.requestPayout(
            user,
            requestPayoutDto.amount,
        );
    }
}
