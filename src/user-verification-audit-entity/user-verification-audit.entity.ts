import { UserEntity } from 'src/user/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class UserVerificationAuditEntity {
  @PrimaryGeneratedColumn()
  id: number;

   @Column({ nullable: true })
  reason?: string;

  @Column()
  isApproved: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // The user being verified
  @ManyToOne(() => UserEntity, (user) => user.verificationLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reviewedUser' })
  reviewedUser: UserEntity;

  // The admin who reviewed the verification
  @ManyToOne(() => UserEntity, (admin) => admin.verificationActions, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'verifiedBy' })
  verifiedBy: UserEntity;

}
