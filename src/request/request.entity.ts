import { BaseEntity } from 'src/baseEntity/base.entity';
import { DeliveyProofEntity } from 'src/delivery-proof/delivery-proof.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { InsuranceEntity } from 'src/insurance/insurance.entity';
import { LegalProtectionEntity } from 'src/legal-protection/legal-protection.entity';
import { MessageEntity } from 'src/message/message.entity';
import { RequestStatusHistoryEntity } from 'src/request-status-history/RequestStatusHistory.entity';
import { RequestStatusEntity } from 'src/request-status/requestStatus.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { UserEntity } from 'src/user/user.entity';
import { UploadedFileEntity } from 'src/uploaded-file/uploaded-file.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';

/*
 *jotsamikael
 *Represents a match between a sender and a traveler.
 *This is the core transaction unit that binds an announcement and a travel. It includes proposed price, package info, and triggers insurance and legal protection services.
 */

@Entity()
export class RequestEntity extends BaseEntity {
  @Column({ nullable: true }) // Make nullable
  demandId: number | null;

  @Column({ nullable: true }) // Make nullable
  travelId: number | null;

  @Column({ nullable: true })
  requesterId: number; // Add this property too

  @Column({ type: 'enum', enum: ['GoAndGive', 'GoAndGo'] })
  requestType: 'GoAndGive' | 'GoAndGo';


  @Column('decimal', { precision: 10, scale: 2,nullable: true })
  weight: number|null;

  // Stripe Payment Method ID (for non-instant travels, stored when request is created)
  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentMethodId: string | null;

  // Add current status property
  @Column({ nullable: true })
  currentStatusId: number;

  @ManyToOne(() => RequestStatusEntity)
  @JoinColumn({ name: 'currentStatusId' })
  currentStatus: RequestStatusEntity;

  @OneToMany(() => RequestStatusHistoryEntity, (r) => r.request, { cascade: true })
  requestStatusHistory: RequestStatusHistoryEntity[];

  @OneToOne(() => InsuranceEntity, (r) => r.request)
  insurance: InsuranceEntity;

  @OneToOne(() => LegalProtectionEntity, (l) => l.request)
  legalProtections: LegalProtectionEntity;

  @OneToOne(() => DeliveyProofEntity, (d) => d.request)
  deliveryProof: DeliveyProofEntity;

  @OneToMany(() => TransactionEntity, (t) => t.request)
  transactions: TransactionEntity[];

  @OneToMany(() => MessageEntity, (m) => m.request)
  messages: MessageEntity[];


  @ManyToOne(() => DemandEntity, (d) => d.requests)
  @JoinColumn({ name: 'demandId' })
  demand: DemandEntity;

  @ManyToOne(() => TravelEntity, (d) => d.requests)
  @JoinColumn({ name: 'travelId' })
  travel: TravelEntity;

  @ManyToOne(() => UserEntity, (d) => d.requests)
  @JoinColumn({ name: 'requesterId' })
  requester: UserEntity;

  // Cancellation confirmation tracking fields
  @Column({ type: 'datetime', nullable: true })
  cancellationRequestedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  cancellationConfirmedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  cancellationDisputedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  cancellationConfirmedBy: number | null;

  // Weight reservation tracking for travel requests
  @Column({ type: 'boolean', default: false })
  isWeightReserved: boolean;

  @Column({ type: 'datetime', nullable: true })
  weightReservedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  weightReleasedAt: Date | null;

  /** Admin settlement after PROOF_DEADLINE_MISSED */
  @Column({ type: 'datetime', nullable: true })
  settledAt: Date | null;

  @Column({ type: 'int', nullable: true })
  settledByUserId: number | null;

  @Column({
    type: 'enum',
    enum: ['CANCEL_AND_REFUND', 'COMPLETE_AND_RELEASE_FUNDS'],
    nullable: true,
  })
  settleAction: 'CANCEL_AND_REFUND' | 'COMPLETE_AND_RELEASE_FUNDS' | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  settleNote: string | null;
}
