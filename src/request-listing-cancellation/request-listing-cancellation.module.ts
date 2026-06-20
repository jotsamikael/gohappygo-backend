import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { RequestEntity } from 'src/request/request.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { RequestStatusModule } from 'src/request-status/request-status.module';
import { RequestStatusHistoryModule } from 'src/request-status-history/request-status-history.module';
import { TransactionModule } from 'src/transaction/transaction.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { UserModule } from 'src/user/user.module';
import { EventsModule } from 'src/events/events.module';
import { RequestListingCancellationService } from './request-listing-cancellation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RequestEntity, TravelEntity]),
    RequestStatusModule,
    RequestStatusHistoryModule,
    forwardRef(() => TransactionModule),
    forwardRef(() => StripeModule),
    UserModule,
    EventsModule,
    CacheModule.register(),
  ],
  providers: [RequestListingCancellationService],
  exports: [RequestListingCancellationService],
})
export class RequestListingCancellationModule {}
