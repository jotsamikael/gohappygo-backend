import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Transaction } from 'typeorm';
import { TransactionEntity } from './transaction.entity';
import { RequestEntity } from 'src/request/request.entity';
import { UserEntity, UserRole } from 'src/user/user.entity';
import { StripeService } from 'src/stripe/stripe.service';
import { CurrencyService } from 'src/currency/currency.service';
import { PlatformPricingService } from 'src/platform-pricing/platform-pricing.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FindTransactionQueryDto } from './dto/request/find-transaction-requests-query.dto';
import { PaginatedTransactionResponseDto } from './dto/response/paginated-transaction-response.dto';
import { TransactionMapper } from './transaction.mapper';
import Stripe from 'stripe';

@Injectable()
export class TransactionService {
    private transactionListCacheKeys: Set<string> = new Set();
    private readonly logger = new Logger(TransactionService.name);

    constructor(
        @InjectRepository(TransactionEntity)
        private transactionRepository: Repository<TransactionEntity>,
        private stripeService: StripeService,
        private currencyService: CurrencyService,
        private platformPricingService: PlatformPricingService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private transactionMapper: TransactionMapper,
    ) {}

    //Automatically create transaction from request, when request is accepted
    //At this point payment is done and funds are deducted from payer but are still hold by stripe
     async createTransactionFromRequest(
       request: RequestEntity, 
       transactionAmount: number,
       paymentMethodId?: string,
       transactionalEntityManager?: any,
     ): Promise<TransactionEntity> {
        // Get travel or demand to determine currency
        const travel = request.travel;
        const demand = request.demand;
        
        if (!travel && !demand) {
          throw new BadRequestException('Request must have either travel or demand');
        }

        const sourceEntity = travel || demand;
        const currencyCode = sourceEntity.currency?.code || 'USD';
        const originalAmount = transactionAmount; // This is totalAmount (travelerPayment + fee + TVA)

        // Calculate travelerPayment from transactionAmount
        // Since transactionAmount = totalAmount = travelerPayment + fee + TVA
        // We need to reverse-calculate travelerPayment
        // For amounts > 151: fee = 0.15 * travelerPayment, TVA = 0.20 * fee = 0.03 * travelerPayment
        // So: totalAmount = travelerPayment + 0.15 * travelerPayment + 0.03 * travelerPayment = 1.18 * travelerPayment
        // Therefore: travelerPayment = totalAmount / 1.18
        // For amounts <= 151: fee is from pricing tiers, need to calculate differently
        
        // First, try to get pricing breakdown to extract travelerPayment
        // We'll use a reverse calculation approach
        let travelerPayment: number;
        
        // Calculate pricing to get the breakdown
        // Note: We need to estimate travelerPayment first, then refine
        // For simplicity, let's calculate: if totalAmount = travelerPayment + fee + TVA
        // And fee = 0.15 * travelerPayment (for > 151), TVA = 0.20 * fee = 0.03 * travelerPayment
        // Then: totalAmount = travelerPayment * (1 + 0.15 + 0.03) = travelerPayment * 1.18
        // So: travelerPayment = totalAmount / 1.18
        
        // But this only works if travelerPayment > 151. For <= 151, we need to iterate or use pricing service
        // Let's use an iterative approach or calculate from the weight and pricePerKg
        
        // Calculate travelerPayment from request weight and travel/demand pricePerKg
        // This matches the calculation used in request.service.ts
        const requestWeight = request.weight || 0;
        const pricePerKg = travel?.pricePerKg || demand?.pricePerKg || 0;
        
        if (requestWeight > 0 && pricePerKg > 0) {
          travelerPayment = requestWeight * pricePerKg;
        } else {
          // Fallback: Reverse-calculate from totalAmount
          // For amounts > 151: totalAmount = travelerPayment * 1.18 (fee 15% + TVA 3%)
          // For amounts <= 151: Use pricing service to reverse-calculate
          // Try the simple calculation first
          const estimatedTravelerPayment = originalAmount / 1.18;
          
          // Verify by recalculating totalAmount
          const testPricing = await this.platformPricingService.calculateTotalAmount(estimatedTravelerPayment);
          if (Math.abs(testPricing.totalAmount - originalAmount) < 0.01) {
            travelerPayment = estimatedTravelerPayment;
          } else {
            // If estimation doesn't match, use iterative approach or store null
            // For now, use the estimation as fallback
            travelerPayment = estimatedTravelerPayment;
          }
        }

        // Convert amount to USD
        const convertedAmountUSD = await this.stripeService.convertToUSD(originalAmount, currencyCode);

        // Calculate platform fee (in original currency, then convert to USD)
        const pricing = await this.platformPricingService.calculateTotalAmount(travelerPayment);
        const platformFeeUSD = await this.stripeService.convertToUSD(pricing.fee, currencyCode);

        let paymentIntent: Stripe.PaymentIntent | null = null;
        let stripePaymentIntentId: string | undefined = undefined;

        // Create Payment Intent if paymentMethodId is provided
        if (paymentMethodId) {
          try {
            paymentIntent = await this.stripeService.createPaymentIntent(
              convertedAmountUSD,
              paymentMethodId,
              platformFeeUSD,
              {
                requestId: request.id.toString(),
                payerId: request.requesterId.toString(),
                payeeId: (request.travelId ? request.travel.user.id : request.demand.user.id).toString(),
              },
            );
            stripePaymentIntentId = paymentIntent.id;
          } catch (error) {
            throw new BadRequestException(`Failed to create payment: ${error.message}`);
          }
        }

        const transaction = transactionalEntityManager 
          ? transactionalEntityManager.create(TransactionEntity, {
              requestId: request.id,
              payerId: request.requesterId, // The person who made the request pays
              payeeId: request.travelId ? request.travel.user.id : request.demand.user.id, // Travel creator or demand creator receives payment
              status: paymentIntent?.status === 'succeeded' ? 'paid' : 'pending', // Payment needs to be processed
              paymentMethod: paymentMethodId ? 'stripe' : 'platform',
              amount: originalAmount,
              stripePaymentIntentId,
              currencyCode,
              originalAmount,
              convertedAmount: convertedAmountUSD,
              travelerPayment: travelerPayment, // Store the amount traveler should receive
            })
          : this.transactionRepository.create({
              requestId: request.id,
              payerId: request.requesterId, // The person who made the request pays
              payeeId: request.travelId ? request.travel.user.id : request.demand.user.id, // Travel creator or demand creator receives payment
              status: paymentIntent?.status === 'succeeded' ? 'paid' : 'pending', // Payment needs to be processed
              paymentMethod: paymentMethodId ? 'stripe' : 'platform',
              amount: originalAmount,
              stripePaymentIntentId,
              currencyCode,
              originalAmount,
              convertedAmount: convertedAmountUSD,
              travelerPayment: travelerPayment, // Store the amount traveler should receive
            });
      
        return transactionalEntityManager
          ? await transactionalEntityManager.save(TransactionEntity, transaction)
          : await this.transactionRepository.save(transaction);
      }



    async getTransactionById(id: number): Promise<TransactionEntity> {
        const transaction = await this.transactionRepository.findOne({ where: { id } });
        if (!transaction) {
            throw new NotFoundException('Transaction not found');
        }
        return transaction;
    }

    //get all transactions where user is payer or payee
   async getTransactionsByUserId(userId: number): Promise<TransactionEntity[]> {
    return this.transactionRepository.find({
        where: [
          { payerId: userId },
          { payeeId: userId }
        ]
      });
   }

   /**
    * Get all transactions with filtering, pagination, and caching
    */
   async findAll(query: FindTransactionQueryDto, user: UserEntity): Promise<PaginatedTransactionResponseDto> {
    const cacheKey = this.generateTransactionListCacheKey(query, user.id);
    this.transactionListCacheKeys.add(cacheKey);

    // Check cache first
    const cachedData = await this.cacheManager.get<PaginatedTransactionResponseDto>(cacheKey);
    if (cachedData) {
      console.log(`Cache Hit---------> Returning transactions list from Cache ${cacheKey}`);
      return cachedData;
    }
    console.log(`Cache Miss---------> Returning transactions list from database`);

    const {
      page = 1,
      limit = 10,
      id,
      payerId,
      payeeId,
      requestId,
      minAmount,
      maxAmount,
      date,
      status,
      orderBy = 'createdAt:desc',
    } = query;

    const skip = (page - 1) * limit;

    // Build query
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.payer', 'payer')
      .leftJoinAndSelect('transaction.payee', 'payee')
      .leftJoinAndSelect('transaction.request', 'request')
      .skip(skip)
      .take(limit);

    // Role-based filtering
    const isAdmin = user.role?.code === UserRole.ADMIN;
    const isOperator = user.role?.code === UserRole.OPERATOR;

    if (!isAdmin && !isOperator) {
      // Regular users: only see transactions where they are payer or payee
      queryBuilder.andWhere(
        '(transaction.payerId = :userId OR transaction.payeeId = :userId)',
        { userId: user.id }
      );
    }

    // Apply filters
    if (id) {
      queryBuilder.andWhere('transaction.id = :id', { id });
    }

    if (payerId) {
      if (!isAdmin && !isOperator) {
        throw new ForbiddenException('Only admins can filter by payerId');
      }
      queryBuilder.andWhere('transaction.payerId = :payerId', { payerId });
    }

    if (payeeId) {
      if (!isAdmin && !isOperator) {
        throw new ForbiddenException('Only admins can filter by payeeId');
      }
      queryBuilder.andWhere('transaction.payeeId = :payeeId', { payeeId });
    }

    if (requestId) {
      if (!isAdmin && !isOperator) {
        throw new ForbiddenException('Only admins can filter by requestId');
      }
      queryBuilder.andWhere('transaction.requestId = :requestId', { requestId });
    }

    if (minAmount !== undefined) {
      queryBuilder.andWhere('transaction.amount >= :minAmount', { minAmount });
    }

    if (maxAmount !== undefined) {
      queryBuilder.andWhere('transaction.amount <= :maxAmount', { maxAmount });
    }

    if (date) {
      const dateString = new Date(date).toISOString().split('T')[0];
      queryBuilder.andWhere('DATE(transaction.createdAt) = :dateString', { dateString });
    }

    if (status) {
      queryBuilder.andWhere('transaction.status = :status', { status });
    }

    // Apply sorting
    const [sortField, sortDirection] = orderBy.split(':');
    const validSortFields = ['id', 'amount', 'createdAt', 'updatedAt', 'status'];
    const validSortDirections = ['asc', 'desc'];

    if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      queryBuilder.orderBy(`transaction.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy('transaction.createdAt', 'DESC'); // default
    }

    // Get count and items
    const totalItems = await queryBuilder.getCount();
    const items = await queryBuilder.getMany();

    // Transform using mapper
    const transformedItems = items.map(transaction => this.transactionMapper.toResponseDto(transaction));

    const totalPages = Math.ceil(totalItems / limit);

    const responseResult: PaginatedTransactionResponseDto = {
      items: transformedItems,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };

    await this.cacheManager.set(cacheKey, responseResult, 30000);
    return responseResult;
   }

   /**
    * Generate cache key for transaction list queries
    */
   private generateTransactionListCacheKey(query: FindTransactionQueryDto, userId: number): string {
    const {
      page = 1,
      limit = 10,
      id,
      payerId,
      payeeId,
      requestId,
      minAmount,
      maxAmount,
      date,
      status,
      orderBy = 'createdAt:desc',
    } = query;

    return `transactions_list_page${page}_limit${limit}_id${id || 'all'}_payer${payerId || 'all'}_payee${payeeId || 'all'}_request${requestId || 'all'}_min${minAmount || 'all'}_max${maxAmount || 'all'}_date${date || 'all'}_status${status || 'all'}_order${orderBy}_user${userId}`;
   }

   /**
    * Clear transaction list cache
    */
   private async clearTransactionListCache(): Promise<void> {
    const cacheKeys = Array.from(this.transactionListCacheKeys);
    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }
    this.transactionListCacheKeys.clear();
   }

   //After service is performed, funds are released from stripe to payee
   //This is triggered when payer marks request as completed
   async releaseFundsFromStripe(transactionId: number, user: UserEntity): Promise<void> {
    const transaction = await this.getTransactionById(transactionId);
    if (!transaction) {
        throw new NotFoundException('Transaction not found');
    }
    //check if user is payer
    if (transaction.payerId !== user.id) {
        throw new ForbiddenException('You are not the payer of this transaction');
    }
    //check if transaction status is 'paid' or 'awaiting_transfer' (funds are already collected)
    if (transaction.status !== 'paid' && transaction.status !== 'awaiting_transfer') {
        throw new BadRequestException('Transaction must be in paid or awaiting_transfer status to release funds');
    }

    // If no Stripe Payment Intent, just update status (legacy transactions)
    if (!transaction.stripePaymentIntentId) {
      await this.transactionRepository.update(transactionId, { status: 'paid' });
      return;
    }

    // Get charge ID from Payment Intent
    const chargeId = await this.stripeService.getChargeIdFromPaymentIntent(transaction.stripePaymentIntentId);

    // Get payee (traveler) user
    const payee = await this.transactionRepository.manager.findOne(UserEntity, {
      where: { id: transaction.payeeId },
    });

    if (!payee) {
      throw new NotFoundException('Payee not found');
    }

    if (!payee.stripeAccountId) {
      throw new BadRequestException('Payee does not have a Stripe Connect account');
    }

    // Check if payee can receive transfers
    // Note: Stripe requires the 'transfers' capability to be 'active' (not just 'pending')
    // The capability becomes 'active' after basic onboarding setup (not full KYC)
    // Full KYC (detailsSubmitted) is only required for withdrawals, not transfers
    const accountStatus = await this.stripeService.getAccountStatus(payee.stripeAccountId);
    
    // Log capability status for debugging
    console.log(`Account ${payee.stripeAccountId} transfer capability status:`, {
      transfersEnabled: accountStatus.transfersEnabled,
      status: accountStatus.status,
      detailsSubmitted: accountStatus.detailsSubmitted,
    });
    
    // Check if transfers capability is active before attempting transfer
    if (!accountStatus.transfersEnabled) {
      throw new BadRequestException(
        'Payee must complete basic Stripe onboarding to enable transfers. ' +
        'The transfers capability must be active before funds can be transferred. ' +
        'Please complete onboarding via the Stripe onboarding link.'
      );
    }

    // Calculate traveler amount - use stored travelerPayment if available
    let travelerAmountUSD: number;

    if (transaction.travelerPayment !== null && transaction.travelerPayment !== undefined) {
      // Use stored travelerPayment (preferred method)
      travelerAmountUSD = await this.stripeService.convertToUSD(
        transaction.travelerPayment,
        transaction.currencyCode || 'USD'
      );
    } else {
      // Fallback: calculate from originalAmount (for legacy transactions)
      // Reverse-calculate travelerPayment: totalAmount = travelerPayment + fee + TVA
      // For amounts > 151: fee = 0.15 * travelerPayment, TVA = 0.03 * travelerPayment
      // So: totalAmount = travelerPayment * 1.18, therefore: travelerPayment = totalAmount / 1.18
      const fee = await this.platformPricingService.calculateFee(transaction.originalAmount || transaction.amount);
      const tvaAmount = (20 / 100) * fee; // 20% TVA
      const travelerPayment = (transaction.originalAmount || transaction.amount) - fee - tvaAmount;
      travelerAmountUSD = await this.stripeService.convertToUSD(
        travelerPayment,
        transaction.currencyCode || 'USD'
      );
    }

      // Create Transfer to traveler's Stripe Connect account
    try {
      const transfer = await this.stripeService.createTransfer(
        travelerAmountUSD,
        payee.stripeAccountId,
        chargeId,
      );

      // Update transaction with transfer ID and status
      await this.transactionRepository.update(transactionId, {
        stripeTransferId: transfer.id,
      });

      // Clear cache after releasing funds
      await this.clearTransactionListCache();
    } catch (error) {
      throw new BadRequestException(`Failed to create transfer: ${error.message}`);
    }
   }
    

   async getTransactionByRequestId(requestId: number): Promise<TransactionEntity > {
    const transaction = await this.transactionRepository.findOne({ where: { requestId } });
    if (!transaction) {
        throw new NotFoundException('Transaction not found');
    }
    return transaction;
   }

   /**
    * Update transaction status
    */
   async updateTransactionStatus(transactionId: number, status: 'pending' | 'paid' | 'awaiting_transfer' | 'refunded' | 'cancelled'): Promise<void> {
    await this.transactionRepository.update(transactionId, { status });
    // Clear cache after status update
    await this.clearTransactionListCache();
   }

   /**
    * Release funds for a transaction (used by webhook handler, no user validation)
    */
   async releaseFundsForTransaction(transactionId: number): Promise<void> {
    const transaction = await this.getTransactionById(transactionId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Only process if status is awaiting_transfer or paid
    if (transaction.status !== 'awaiting_transfer' && transaction.status !== 'paid') {
      this.logger.warn(`Transaction ${transactionId} is in status ${transaction.status}, skipping fund release`);
      return;
    }

    // Check if transfer already created
    if (transaction.stripeTransferId) {
      this.logger.log(`Transaction ${transactionId} already has transfer ${transaction.stripeTransferId}, skipping`);
      return;
    }

    // If no Stripe Payment Intent, just update status (legacy transactions)
    if (!transaction.stripePaymentIntentId) {
      await this.transactionRepository.update(transactionId, { status: 'paid' });
      return;
    }

    // Get charge ID from Payment Intent
    const chargeId = await this.stripeService.getChargeIdFromPaymentIntent(transaction.stripePaymentIntentId);

    // Get payee (traveler) user
    const payee = await this.transactionRepository.manager.findOne(UserEntity, {
      where: { id: transaction.payeeId },
    });

    if (!payee) {
      throw new NotFoundException('Payee not found');
    }

    if (!payee.stripeAccountId) {
      throw new BadRequestException('Payee does not have a Stripe Connect account');
    }

    // Check if payee can receive transfers
    const accountStatus = await this.stripeService.getAccountStatus(payee.stripeAccountId);
    
    if (!accountStatus.transfersEnabled) {
      this.logger.warn(`Account ${payee.stripeAccountId} does not have transfers enabled yet, keeping transaction ${transactionId} in awaiting_transfer status`);
      return;
    }

    // Calculate traveler amount - use stored travelerPayment if available
    let travelerAmountUSD: number;

    if (transaction.travelerPayment !== null && transaction.travelerPayment !== undefined) {
      travelerAmountUSD = await this.stripeService.convertToUSD(
        transaction.travelerPayment,
        transaction.currencyCode || 'USD'
      );
    } else {
      const fee = await this.platformPricingService.calculateFee(transaction.originalAmount || transaction.amount);
      const tvaAmount = (20 / 100) * fee;
      const travelerPayment = (transaction.originalAmount || transaction.amount) - fee - tvaAmount;
      travelerAmountUSD = await this.stripeService.convertToUSD(
        travelerPayment,
        transaction.currencyCode || 'USD'
      );
    }

    // Create Transfer to traveler's Stripe Connect account
    try {
      const transfer = await this.stripeService.createTransfer(
        travelerAmountUSD,
        payee.stripeAccountId,
        chargeId,
      );

      // Update transaction with transfer ID and status
      await this.transactionRepository.update(transactionId, {
        stripeTransferId: transfer.id,
        status: 'paid', // Funds successfully transferred
      });

      // Clear cache after releasing funds
      await this.clearTransactionListCache();
      
      this.logger.log(`Successfully released funds for transaction ${transactionId}, transfer ID: ${transfer.id}`);
    } catch (error) {
      this.logger.error(`Failed to create transfer for transaction ${transactionId}: ${error.message}`, error.stack);
      throw error;
    }
   }

   /**
    * Get user balance from Stripe
    */
   async getUserBalance(user: UserEntity): Promise<{
    available: number;
    pending: number;
    currency: string;
   }> {
    if (!user.stripeAccountId) {
      return {
        available: 0,
        pending: 0,
        currency: 'usd',
      };
    }

    const balance = await this.stripeService.getAccountBalance(user.stripeAccountId);

    return {
      available: balance.available[0]?.amount ? balance.available[0].amount / 100 : 0,
      pending: balance.pending[0]?.amount ? balance.pending[0].amount / 100 : 0,
      currency: balance.available[0]?.currency || 'usd',
    };
   }
}
