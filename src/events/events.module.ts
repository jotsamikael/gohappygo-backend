import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UserEventsService } from './user-events.service';
import { AllEventsListener } from './listeners/all-events.listener';
import { EmailModule } from 'src/email/email.module';
import { UserModule } from 'src/user/user.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    UserModule,
    EmailModule,
    CommonModule,
    EventEmitterModule.forRoot({
      global: true,
      wildcard: false,
      maxListeners: 20,
      verboseMemoryLeak: true
    })
  ],
  providers: [
    UserEventsService,
    AllEventsListener
  ],
  exports: [UserEventsService]
})
export class EventsModule {}
