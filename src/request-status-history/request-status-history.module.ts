import { Module } from '@nestjs/common';
import { RequestStatusHistoryController } from './request-status-history.controller';
import { RequestStatusHistoryService } from './request-status-history.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestStatusHistoryEntity } from './RequestStatusHistory.entity';

@Module({
  imports:[TypeOrmModule.forFeature([RequestStatusHistoryEntity])],
  controllers: [RequestStatusHistoryController],
  providers: [RequestStatusHistoryService],
  exports: [RequestStatusHistoryService]

})
export class RequestStatusHistoryModule {}
