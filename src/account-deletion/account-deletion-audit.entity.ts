import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('account_deletion_audit')
export class AccountDeletionAuditEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'timestamp' })
  completedAt: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  requestIp?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  appVersion?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  originalEmailHash?: string | null;
}
