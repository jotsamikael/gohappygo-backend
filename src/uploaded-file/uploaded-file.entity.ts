import { UserEntity } from "src/user/user.entity";
import { TravelEntity } from "src/travel/travel.entity";
import { DemandEntity } from "src/demand/demand.entity";
import { BeforeInsert, Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { FilePurpose } from "./uploaded-file-purpose.enum";
import { PublicIdPrefix } from "src/common/public-id/public-id-prefix.enum";
import { generatePublicId } from "src/common/public-id/public-id.util";

@Entity()
export class UploadedFileEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 40, unique: true, nullable: true })
  publicId: string;

  @Column()
  originalName: string;

  @Column()
  fileUrl: string;

  @Column()
  size: number;

  @Column({ name: 'cloudinaryPublicId' })
  cloudinaryPublicId: string;

  @Column()
  mimeType: string;

  @Column()
  purpose: FilePurpose;

  @CreateDateColumn()
  uploadedAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user: UserEntity;

  @Column({ nullable: true })
  travelId: number;

  @Column({ nullable: true })
  demandId: number;

  @ManyToOne(() => TravelEntity, { nullable: true, onDelete: 'CASCADE' })
  travel: TravelEntity;

  @ManyToOne(() => DemandEntity, { nullable: true, onDelete: 'CASCADE' })
  demand: DemandEntity;

  @BeforeInsert()
  assignPublicId(): void {
    if (!this.publicId) {
      this.publicId = generatePublicId(PublicIdPrefix.UPLOADED_FILE);
    }
  }
}
