import { BaseEntity } from "src/baseEntity/base.entity";
import { RequestEntity } from "src/request/request.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from "typeorm";

/*jotsamikael
*Represents legal protection automatically granted to the traveler for a given request. 
*Triggers support services in case of disputes or incidents during transport.
*/
@Entity()
export class LegalProtectionEntity extends BaseEntity{

  @Column()
  requestId: number;

  @Column({ default: true })
  activated: boolean;

  @Column({ type: 'date' })
  activationDate: Date;

  @Column({ nullable: true })
  lawyerAssigned: string;

    @OneToOne(()=>RequestEntity,(r)=>r.legalProtections) //As soon as a Request is created (whether GoAndGive or GoAndGo), a corresponding LegalProtection entry must be generated.
    @JoinColumn({ name: 'requestId' })
    request: RequestEntity; //This LegalProtection record:Is tied exclusively to that requestIs free (no user action or payment needed) May remain unused, unless a legal incident occurs
}