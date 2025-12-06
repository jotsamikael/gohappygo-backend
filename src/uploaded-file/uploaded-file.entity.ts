import { UserEntity } from "src/user/user.entity";
import { TravelEntity } from "src/travel/travel.entity";
import { DemandEntity } from "src/demand/demand.entity";
import { RequestEntity } from "src/request/request.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { FilePurpose } from "./uploaded-file-purpose.enum";

@Entity()
export class UploadedFileEntity{
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  originalName: string;

  @Column()
  fileUrl: string;

  @Column()
  size: number

  @Column()
  publicId: string;

  @Column()
  mimeType: string;

  @Column()
  purpose: FilePurpose

  @CreateDateColumn()
  uploadedAt: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user: UserEntity;

  // Foreign key columns for travel, demand, and request
  @Column({ nullable: true })
  travelId: number;

  @Column({ nullable: true })
  demandId: number;


  // Relationships
  @ManyToOne(() => TravelEntity, { nullable: true, onDelete: 'CASCADE' })
  travel: TravelEntity;

  @ManyToOne(() => DemandEntity, { nullable: true, onDelete: 'CASCADE' })
  demand: DemandEntity;

}