import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { UserEntity } from 'src/user/user.entity';

export enum NotificationType {
  // Request notifications
  REQUEST_SUBMITTED = 'REQUEST_SUBMITTED',
  REQUEST_ACCEPTED = 'REQUEST_ACCEPTED',
  REQUEST_REJECTED = 'REQUEST_REJECTED',
  REQUEST_COMPLETED = 'REQUEST_COMPLETED',
  REQUEST_CANCELLED = 'REQUEST_CANCELLED',
  REQUEST_DELIVERED = 'REQUEST_DELIVERED',
  
  // Review notifications
  REVIEW_RECEIVED = 'REVIEW_RECEIVED',
  
  // Travel/Demand notifications
  TRAVEL_PUBLISHED = 'TRAVEL_PUBLISHED',
  DEMAND_PUBLISHED = 'DEMAND_PUBLISHED',
  TRAVEL_MATCHED = 'TRAVEL_MATCHED',
  DEMAND_MATCHED = 'DEMAND_MATCHED',
  
  // Payment notifications
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  TRANSACTION_CREATED = 'TRANSACTION_CREATED',
  
  // Account notifications
  ACCOUNT_VERIFIED = 'ACCOUNT_VERIFIED',
  ACCOUNT_VERIFICATION_FAILED = 'ACCOUNT_VERIFICATION_FAILED',
  VERIFICATION_DOCUMENTS_RECEIVED = 'VERIFICATION_DOCUMENTS_RECEIVED',
  
  // System notifications
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
}

export enum EntityType {
  REQUEST = 'REQUEST',
  REVIEW = 'REVIEW',
  TRAVEL = 'TRAVEL',
  DEMAND = 'DEMAND',
  TRANSACTION = 'TRANSACTION',
  USER = 'USER',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Entity('notification')
@Index(['targetUserId', 'createdAt']) // For efficient queries
@Index(['targetUserId', 'readAt']) // For unread count queries
export class NotificationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: NotificationType })
  notificationType: NotificationType;

  @Column()
  @Index()
  targetUserId: number;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'targetUserId' })
  targetUser: UserEntity;

  @Column({ nullable: true })
  actorUserId: number; // Who caused this notification

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'actorUserId' })
  actor: UserEntity;

  @Column({ type: 'enum', enum: EntityType, nullable: true })
  entityType: EntityType;

  @Column({ nullable: true })
  entityId: number;

  @Column()
  title: string; // e.g., "New Request Received"


  @Column({ type: 'enum', enum: NotificationPriority, default: NotificationPriority.NORMAL })
  priority: NotificationPriority;

  @Column({ nullable: true })
  readAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date; // Soft delete
}
