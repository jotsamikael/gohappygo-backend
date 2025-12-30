import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertService } from './alert.service';
import { AlertController } from './alert.controller';
import { AirportModule } from 'src/airport/airport.module';
import { CacheModule } from '@nestjs/cache-manager';
import { AlertMapper } from './alert.mapper';
import { AlertEntity } from './entities/alert.entity';
import { AlertEventsListener } from './alert-events.listener';
import { NotificationModule } from 'src/notification/notification.module';
import { EmailModule } from 'src/email/email.module';
import { DemandEntity } from 'src/demand/demand.entity';
import { TravelEntity } from 'src/travel/travel.entity';

@Module({
  controllers: [AlertController],
  providers: [AlertService, AlertMapper, AlertEventsListener],
  imports: [
    AirportModule,
    CacheModule.register(),
    NotificationModule,
    EmailModule,
    TypeOrmModule.forFeature([AlertEntity, DemandEntity, TravelEntity]),
  ],
  exports: [AlertService],
})
export class AlertModule {}
