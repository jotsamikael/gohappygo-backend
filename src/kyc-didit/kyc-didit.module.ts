import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycDiditService } from './kyc-didit.service';
import { KycDiditController } from './kyc-didit.controller';
import { UserEntity } from '../user/user.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    HttpModule, 
    TypeOrmModule.forFeature([UserEntity]),
    EventsModule
  ],
  controllers: [KycDiditController],
  providers: [KycDiditService],
  exports: [KycDiditService],
})
export class KycDiditModule {}
