import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from 'src/user/user.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { PlatformPricingModule } from 'src/platform-pricing/platform-pricing.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeWebhookEventEntity } from './entities/stripe-webhook-event.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    CurrencyModule,
    PlatformPricingModule,
    TypeOrmModule.forFeature([StripeWebhookEventEntity, TransactionEntity]),
  ],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}

