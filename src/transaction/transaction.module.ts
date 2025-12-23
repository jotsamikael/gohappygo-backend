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
import { CacheModule } from '@nestjs/cache-manager';
import { TransactionMapper } from './transaction.mapper';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity]),
    StripeModule,
    CurrencyModule,
    PlatformPricingModule,
    CacheModule.register(),
  ],
  controllers: [TransactionController],
  providers: [TransactionService, TransactionMapper],
  exports: [TransactionService]
})
export class TransactionModule {}
