import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UserEventsService } from './user-events.service';
import { AllEventsListener } from './listeners/all-events.listener';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    EmailModule,
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
