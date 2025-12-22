import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Transaction } from 'typeorm';
import { TransactionEntity } from './transaction.entity';
import { RequestEntity } from 'src/request/request.entity';
import { UserEntity } from 'src/user/user.entity';
import { StripeService } from 'src/stripe/stripe.service';
import { CurrencyService } from 'src/currency/currency.service';
import { PlatformPricingService } from 'src/platform-pricing/platform-pricing.service';
import Stripe from 'stripe';

@Injectable()
export class TransactionService {


    constructor(
        @InjectRepository(TransactionEntity)
        private transactionRepository: Repository<TransactionEntity>,
        private stripeService: StripeService,
        private currencyService: CurrencyService,
        private platformPricingService: PlatformPricingService,
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
        const originalAmount = transactionAmount;

        // Convert amount to USD
        const convertedAmountUSD = await this.stripeService.convertToUSD(originalAmount, currencyCode);

        // Calculate platform fee (in original currency, then convert to USD)
        const pricing = await this.platformPricingService.calculateTotalAmount(originalAmount);
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
    //check if transaction is pending
    if (transaction.status !== 'pending') {
        throw new BadRequestException('Transaction is not pending');
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

    // Check if payee has completed KYC (can receive transfers)
    const accountStatus = await this.stripeService.getAccountStatus(payee.stripeAccountId);
    if (!accountStatus.transfersEnabled || !accountStatus.detailsSubmitted) {
      throw new BadRequestException('Payee must complete Stripe onboarding to receive payments. Please complete KYC first.');
    }

    // Calculate traveler amount (total - platform fee)
    const totalAmountUSD = transaction.convertedAmount || 0;
    const platformFeeUSD = await this.stripeService.convertToUSD(
      await this.platformPricingService.calculateFee(transaction.originalAmount || transaction.amount),
      transaction.currencyCode || 'USD'
    );
    const travelerAmountUSD = totalAmountUSD - platformFeeUSD;

      // Create Transfer to traveler's Stripe Connect account
    try {
      const transfer = await this.stripeService.createTransfer(
        travelerAmountUSD,
        payee.stripeAccountId,
        chargeId,
      );

      // Update transaction with transfer ID and status
      await this.transactionRepository.update(transactionId, {
        status: 'paid',
        stripeTransferId: transfer.id,
      });
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
}
