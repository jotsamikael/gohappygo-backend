import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnfidoKycService } from './onfido-kyc.service';
import { OnfidoKycController } from './onfido-kyc.controller';
import { UserEntity } from '../user/user.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    HttpModule, 
    TypeOrmModule.forFeature([UserEntity]),
    EventsModule
  ],
  controllers: [OnfidoKycController],
  providers: [OnfidoKycService],
  exports: [OnfidoKycService],
})
export class OnfidoKycModule {}
