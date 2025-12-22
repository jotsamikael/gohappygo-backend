import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from 'src/user/user.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeWebhookEventEntity } from './entities/stripe-webhook-event.entity';

@Module({
  imports: [
    ConfigModule,
    UserModule,
    CurrencyModule,
    TypeOrmModule.forFeature([StripeWebhookEventEntity]),
  ],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}

