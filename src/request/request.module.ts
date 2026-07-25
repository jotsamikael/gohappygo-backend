import { Module, forwardRef } from '@nestjs/common';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestEntity } from './request.entity';
import { ReviewEntity } from 'src/review/review.entity';
import { UserEntity } from 'src/user/user.entity';
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
import { RequestCacheListener } from './request-cache.listener';
import { AirlineModule } from 'src/airline/airline.module';
import { AirportModule } from 'src/airport/airport.module';
import { PlatformPricingModule } from 'src/platform-pricing/platform-pricing.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { MessageModule } from 'src/message/message.module';
import { EmailModule } from 'src/email/email.module';
import { DeliveryProofModule } from 'src/delivery-proof/delivery-proof.module';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Module({
  imports: [
    TypeOrmModule.forFeature([RequestEntity, ReviewEntity, UserEntity]),
    DeliveryProofModule,
    MulterModule.register({ storage: memoryStorage() }),
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
    forwardRef(() => MessageModule),
    EmailModule
  ],
  controllers: [RequestController],
  providers: [RequestService, RequestMapper, RequestCacheListener],
  exports: [RequestService, DeliveryProofModule],
})
export class RequestModule {}
