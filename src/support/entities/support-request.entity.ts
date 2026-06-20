import { BeforeInsert, Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { SupportLogEntity } from "./support-log.entity";
import { PublicIdPrefix } from "src/common/public-id/public-id-prefix.enum";
import { generatePublicId } from "src/common/public-id/public-id.util";

export enum SupportStatus {
  PENDING = 'PENDING',
  RESOLVING = 'RESOLVING',
  CLOSED = 'CLOSED',
}

export enum SupportRequesterType {
    VISITOR = 'VISITOR',
    USER = 'USER',
}

export enum SupportCategory {
  TECHNICAL = 'TECHNICAL',
  BILLING = 'BILLING',
  FINANCIAL = 'FINANCIAL',
  INFORMATIONAL = 'INFORMATIONAL',
  GENERAL = 'GENERAL',
  OTHER = 'OTHER',
}

@Entity()
export class SupportRequestEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true, nullable: true })
  publicId: string;

  @Column({ nullable: false })
  email: string;

  @Column({ nullable: false })
  message: string;

  @Column({ type: 'enum', enum: SupportRequesterType })
  supportRequesterType: SupportRequesterType;

  @Column({ type: 'enum', enum: SupportStatus })
  status: SupportStatus;

  @Column({ type: 'enum', enum: SupportCategory })
  supportCategory: SupportCategory; // The category of the support request

  @OneToMany(() => SupportLogEntity, (log) => log.supportRequest)
  logs: SupportLogEntity[]; // The logs of the support request

  @Column({ nullable: false })
  createdAt: Date;

  @Column({ nullable: false })
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt: Date;

  @BeforeInsert()
  assignPublicId(): void {
    if (!this.publicId) {
      this.publicId = generatePublicId(PublicIdPrefix.SUPPORT_REQUEST);
    }
  }
}
