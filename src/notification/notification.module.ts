import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEntity } from './entities/notification.entity';
import { UserDeviceTokenEntity } from './entities/user-device-token.entity';
import { NotificationMapper } from './notification.mapper';
import { NotificationEventsListener } from './notification-events.listener';
import { CommonModule } from 'src/common/common.module';
import { DeviceTokenService } from './device-token.service';
import { FcmPushPayloadBuilder } from './fcm-push-payload.builder';
import { FirebaseModule } from 'src/firebase/firebase.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, UserDeviceTokenEntity]),
    CommonModule,
    FirebaseModule,
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationMapper,
    NotificationEventsListener,
    DeviceTokenService,
    FcmPushPayloadBuilder,
  ],
  exports: [NotificationService, DeviceTokenService],
})
export class NotificationModule {}
