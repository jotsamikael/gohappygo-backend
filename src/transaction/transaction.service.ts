import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Transaction } from 'typeorm';
import { TransactionEntity } from './transaction.entity';
import { RequestEntity } from 'src/request/request.entity';
import { UserEntity } from 'src/user/user.entity';

@Injectable()
export class TransactionService {


    constructor(
        @InjectRepository(TransactionEntity)
        private transactionRepository: Repository<TransactionEntity>,
    ) {}

    //Automatically create transaction from request, when request is accepted
    //At this point payment is done and funds are deducted from payer but are still hold by stripe
     async createTransactionFromRequest(request: RequestEntity, transactionAmount: number): Promise<void> {
        const transaction = this.transactionRepository.create({
          requestId: request.id,
          payerId: request.requesterId, // The person who made the request pays
          payeeId: request.travelId ? request.travel.user.id : request.demand.user.id, // Travel creator or demand creator receives payment
          status: 'pending', // Payment needs to be processed
          paymentMethod: 'platform' ,// or whatever default method,
          amount: transactionAmount
        });
      
        await this.transactionRepository.save(transaction);
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
    //release funds from stripe
    await this.transactionRepository.update(transactionId, { status: 'paid' });
   }
    

   async getTransactionByRequestId(requestId: number): Promise<TransactionEntity > {
    const transaction = await this.transactionRepository.findOne({ where: { requestId } });
    if (!transaction) {
        throw new NotFoundException('Transaction not found');
    }
    return transaction;
   }
}
