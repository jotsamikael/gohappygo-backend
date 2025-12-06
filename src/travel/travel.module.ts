import { Module } from '@nestjs/common';
import { TravelController } from './travel.controller';
import { TravelService } from './travel.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TravelEntity } from './travel.entity';
import { FileUploadModule } from 'src/file-upload/file-upload.module';
import { EventsModule } from 'src/events/events.module';
import { AirlineModule } from 'src/airline/airline.module';
import { TravelMapper } from './travel.mapper';
import { BookmarkModule } from 'src/bookmark/bookmark.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { ReviewModule } from 'src/review/review.module';
import { ReviewEntity } from 'src/review/review.entity';
import { RequestEntity } from 'src/request/request.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { RequestStatusModule } from 'src/request-status/request-status.module';

@Module({
  imports:[
    TypeOrmModule.forFeature([TravelEntity, ReviewEntity, RequestEntity, TransactionEntity]),
    FileUploadModule,
    EventsModule,
    AirlineModule,
    RequestStatusModule
    
  ],
  controllers: [TravelController],
  providers: [TravelService, TravelMapper],
exports:[TravelService]
})
export class TravelModule {}
