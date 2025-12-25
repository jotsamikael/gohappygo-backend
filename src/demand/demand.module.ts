import { Module, forwardRef } from '@nestjs/common';
import { DemandController } from './demand.controller';
import { DemandService } from './demand.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemandEntity } from './demand.entity';
import { FileUploadModule } from 'src/file-upload/file-upload.module';
import { EventsModule } from 'src/events/events.module';
import { AirlineService } from 'src/airline/airline.service';
import { AirlineModule } from 'src/airline/airline.module';
import { DemandMapper } from './demand.mapper';
import { ReviewEntity } from 'src/review/review.entity';
import { RequestEntity } from 'src/request/request.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { RequestStatusModule } from 'src/request-status/request-status.module';
import { RequestStatusHistoryModule } from 'src/request-status-history/request-status-history.module';
import { TransactionModule } from 'src/transaction/transaction.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([DemandEntity, ReviewEntity, RequestEntity, TransactionEntity]),
   FileUploadModule,EventsModule, AirlineModule, RequestStatusModule, RequestStatusHistoryModule, forwardRef(() => TransactionModule), forwardRef(() => StripeModule), UserModule],
  controllers: [DemandController],
  providers: [DemandService, DemandMapper],
  exports: [DemandService]

})
export class DemandModule {}
