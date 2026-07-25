import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserEventType } from 'src/events/event-types';
import { RequestEvent } from 'src/events/user-events.service';
import { RequestService } from './request.service';

@Injectable()
export class RequestCacheListener {
  private readonly logger = new Logger(RequestCacheListener.name);

  constructor(private readonly requestService: RequestService) {}

  @OnEvent(UserEventType.MEETING_PROOF_UPLOADED)
  async handleMeetingProofUploaded(event: RequestEvent): Promise<void> {
    const userIds = [event.requesterId, event.ownerId].filter((id) => id > 0);
    await this.requestService.invalidateRequestListCacheForUserIds(userIds);
    this.logger.log(
      `Invalidated request list cache after meeting proof upload for request ${event.requestId}`,
    );
  }
}
