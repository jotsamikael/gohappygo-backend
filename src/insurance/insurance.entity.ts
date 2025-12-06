import { BaseEntity } from "src/baseEntity/base.entity";
import { RequestEntity } from "src/request/request.entity";
import { Column, Entity, JoinColumn, OneToOne } from "typeorm";

/*jotsamikael
*Represents parcel insurance associated with a request. Includes insured amount, provider, and policy metadata.
* Automatically created upon request creation when value > 0.
*/
@Entity()
export class InsuranceEntity extends BaseEntity{

  @Column()
  requestId: number;

  @Column('decimal', { precision: 10, scale: 2 })
  insuredAmount: number;

  @Column()
  provider: string;

  @Column({ nullable: true })
  policyNumber: string;

  @Column({ nullable: true })
  coverageDescription: string;

    @OneToOne(()=>RequestEntity,(r)=>r.insurance)
    @JoinColumn({name:'requestId'})
    request:RequestEntity
}