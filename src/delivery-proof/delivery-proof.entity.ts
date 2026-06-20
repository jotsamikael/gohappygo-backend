import { PublicIdentifiableEntity } from 'src/baseEntity/public-identifiable.entity';
import { PublicIdPrefix } from 'src/common/public-id/public-id-prefix.enum';
import { RequestEntity } from 'src/request/request.entity';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';

/*
 * Meeting proof selfie between buyer and seller at handover.
 * Stored in Cloudinary (authenticated); only cloudinaryPublicId is persisted.
 */
@Entity()
export class DeliveyProofEntity extends PublicIdentifiableEntity {
  static publicIdPrefix = PublicIdPrefix.DELIVERY_PROOF;
  @Column({ type: 'varchar', length: 512, unique: true })
  cloudinaryPublicId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  uploadedAt: Date;

  @Column()
  uploadedByUserId: number;

  @Column({ unique: true })
  requestId: number;

  @OneToOne(() => RequestEntity, (r) => r.deliveryProof, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: RequestEntity;
}
