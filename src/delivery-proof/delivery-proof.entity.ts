import { BaseEntity } from "src/baseEntity/base.entity";
import { RequestEntity } from "src/request/request.entity";
import { Column, Entity, OneToOne } from "typeorm";

/*
*jotsamikael
*Represents visual evidence of package handover, including photos and a selfie with the sender. 
*Required to validate that delivery has occurred.
*/
@Entity()
export class DeliveyProofEntity extends BaseEntity{


 @Column({ type: 'json', nullable: false })
  packagePhoto: any; // array of image URLs or file objects in JSON

  @Column({ type: 'varchar', length: 255, nullable: true })
  selfieWithSender: string; // file URL or path to selfie image

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  uploadedAt: Date;

  @Column()
  requestId: number;

  @OneToOne(() => RequestEntity, (r) => r.deliveryProof, { onDelete: 'CASCADE' }) //means if request is deleted, transaction is also deleted 
  request: RequestEntity;
}