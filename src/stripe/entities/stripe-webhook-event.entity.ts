import { BaseEntity } from 'src/baseEntity/base.entity';
import { Column, Entity } from 'typeorm';

@Entity()
export class StripeWebhookEventEntity extends BaseEntity {
  @Column({ unique: true })
  eventId: string; // Stripe event ID (e.g., 'evt_1234567890')

  @Column()
  eventType: string; // Event type (e.g., 'payment_intent.succeeded')

  @Column({ default: false })
  processed: boolean; // Whether the event has been processed

  @Column('text')
  payload: string; // JSON string of the event payload
}

