import { Module, forwardRef } from '@nestjs/common';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestEntity } from './request.entity';
import { ReviewEntity } from 'src/review/review.entity';
import { FileUploadModule } from 'src/file-upload/file-upload.module';
import { RequestStatusHistoryModule } from 'src/request-status-history/request-status-history.module';
import { DemandModule } from 'src/demand/demand.module';
import { RequestStatusModule } from 'src/request-status/request-status.module';
import { TravelModule } from 'src/travel/travel.module';
import { TransactionModule } from 'src/transaction/transaction.module';
import { CacheModule } from '@nestjs/cache-manager';
import { EventsModule } from 'src/events/events.module';
import { UserModule } from 'src/user/user.module';
import { RequestMapper } from './request.mapper';
import { AirlineModule } from 'src/airline/airline.module';
import { AirportModule } from 'src/airport/airport.module';
import { PlatformPricingModule } from 'src/platform-pricing/platform-pricing.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { MessageModule } from 'src/message/message.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RequestEntity, ReviewEntity]),
    FileUploadModule,
    RequestStatusHistoryModule,
    RequestStatusModule,
    TravelModule,
    DemandModule,
    TransactionModule,
    CacheModule.register(),
    EventsModule,
    UserModule,
    AirlineModule,
    AirportModule,
    PlatformPricingModule,
    StripeModule,
    forwardRef(() => MessageModule)
  ],
  controllers: [RequestController],
  providers: [RequestService, RequestMapper],
  exports: [RequestService]
})
export class RequestModule {}
