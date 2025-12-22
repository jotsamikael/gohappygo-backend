import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { TransactionEntity } from './transaction.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestModule } from 'src/request/request.module';
import { UserModule } from 'src/user/user.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { PlatformPricingModule } from 'src/platform-pricing/platform-pricing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity]),
    StripeModule,
    CurrencyModule,
    PlatformPricingModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService]
})
export class TransactionModule {}
