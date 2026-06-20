import { BeforeInsert, Column } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PublicIdPrefix } from 'src/common/public-id/public-id-prefix.enum';
import { generatePublicId } from 'src/common/public-id/public-id.util';

export abstract class PublicIdentifiableEntity extends BaseEntity {
  static publicIdPrefix: PublicIdPrefix;

  @Column({ type: 'varchar', length: 40, unique: true, nullable: true })
  publicId: string;

  @BeforeInsert()
  assignPublicId(): void {
    if (!this.publicId) {
      const prefix = (this.constructor as typeof PublicIdentifiableEntity).publicIdPrefix;
      this.publicId = generatePublicId(prefix);
    }
  }
}
