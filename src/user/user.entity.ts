import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from 'src/baseEntity/base.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { EmailVerificationEntity } from 'src/email-verification/email-verification.entity';
import { MessageEntity } from 'src/message/message.entity';
import { PhoneVerificationEntity } from 'src/phone-verification/phone-verification.entity';
import { RequestEntity } from 'src/request/request.entity';
import { UserRoleEntity } from 'src/role/userRole.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { UploadedFileEntity } from 'src/uploaded-file/uploaded-file.entity';
import { UserVerificationAuditEntity } from 'src/user-verification-audit-entity/user-verification-audit.entity';
import { CurrencyEntity } from 'src/currency/entities/currency.entity';
import { BookmarkEntity } from 'src/bookmark/entities/bookmark.entity';
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
} from 'typeorm';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
}

/*
 *jotsamikael
 *Represents a platform user (either sender or traveler).
 *Stores identity, contact info, and role, and is linked to all activity such as announcements, travels, reviews, and transactions.
 */
@Entity()
export class UserEntity extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  phone: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  profilePictureUrl: string;

  @Column()
  password: string; //hash password

  @Column()
  roleId: number;

  @ManyToOne(() => UserRoleEntity, (userRoleEntity) => userRoleEntity.users)
  role: UserRoleEntity;

  @OneToMany(() => DemandEntity, (d) => d.user)
  demands: DemandEntity[];

  @OneToMany(() => TravelEntity, (t) => t.user)
  travels: TravelEntity[];

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  isVerified: boolean; // Full verification after selfie + ID

   @OneToMany(() => MessageEntity, (messages) => messages.sender)
   messagesSend: MessageEntity[];

  @ApiProperty({ description: 'The messagesReceived of the user' })
   @OneToMany(() => MessageEntity, (messages) => messages.receiver)
   messagesReceived: MessageEntity[];

  @OneToMany(() => PhoneVerificationEntity, (phoneVerification) => phoneVerification.user)
  phoneVerification: PhoneVerificationEntity[];

  @OneToMany(() => EmailVerificationEntity, (emailVerification) => emailVerification.user)
  emailVerification: EmailVerificationEntity[];

  @OneToMany(() => UploadedFileEntity, (file) => file.user)
  files: UploadedFileEntity[];

  /* add near other columns */
@Column({ type: 'varchar', length: 20, default: 'uninitiated' })
kycStatus: 'uninitiated' | 'pending' | 'approved' | 'rejected' | 'failed';

@Column({ type: 'varchar', length: 50, nullable: true })
kycProvider?: 'didit'|'onfido' | null;

@Column({ type: 'varchar', length: 255, nullable: true })
kycReference?: string | null;

@Column({ type: 'timestamp', nullable: true })
kycUpdatedAt?: Date | null;

  // All logs related to the user being verified
  @OneToMany(() => UserVerificationAuditEntity, (log) => log.reviewedUser)
  verificationLogs: UserVerificationAuditEntity[];

  // If this user is an admin, actions they’ve taken
  @OneToMany(() => UserVerificationAuditEntity, (log) => log.verifiedBy)
  verificationActions: UserVerificationAuditEntity[];

   @OneToMany(() => RequestEntity, (request) => request.requester)
  requests: RequestEntity[];

  @Column({ nullable: true })
  firebaseUid?: string;

  // Add currency relationship
  @Column({ nullable: true })
  currencyId: number;

  @ManyToOne(() => CurrencyEntity, (currency) => currency.users, { nullable: true })
  currency: CurrencyEntity;

  @OneToMany(() => BookmarkEntity, (bookmark) => bookmark.user)
  bookmarks: BookmarkEntity[];

  // Rating and review count (denormalized for performance)
  @Column('decimal', { precision: 3, scale: 2, nullable: true, default: null })
  rating: number | null; // Average rating (e.g., 4.75)

  @Column({ type: 'int', default: 0 })
  numberOfReviews: number; // Total count of reviews received

  // Stripe Connect account fields
  @Column({ nullable: true })
  stripeAccountId: string; // Stripe Connect account ID

  @Column({ 
    type: 'enum', 
    enum: ['uninitiated', 'pending', 'active', 'restricted'],
    default: 'uninitiated'
  })
  stripeAccountStatus: 'uninitiated' | 'pending' | 'active' | 'restricted';

  @Column({ type: 'varchar', length: 2, nullable: true })
  stripeCountryCode: string; // ISO 3166-1 alpha-2 country code for Stripe Connect account
}
