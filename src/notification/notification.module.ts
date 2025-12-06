import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEntity } from './entities/notification.entity';
import { NotificationMapper } from './notification.mapper';
import { NotificationEventsListener } from './notification-events.listener';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity]),
    CommonModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationMapper, NotificationEventsListener],
  exports: [NotificationService],
})
export class NotificationModule {}
