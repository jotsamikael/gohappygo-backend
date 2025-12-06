import { Module } from '@nestjs/common';
import { RequestStatusController } from './request-status.controller';
import { RequestStatusService } from './request-status.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestStatusEntity } from './requestStatus.entity';

@Module({
  imports:[TypeOrmModule.forFeature([RequestStatusEntity])],
  controllers: [RequestStatusController],
  providers: [RequestStatusService],
  exports:[RequestStatusService]
})
export class RequestStatusModule {}
