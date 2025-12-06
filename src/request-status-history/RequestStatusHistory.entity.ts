import { BaseEntity } from "src/baseEntity/base.entity";
import { RequestStatusEntity } from "src/request-status/requestStatus.entity";
import { RequestEntity } from "src/request/request.entity";
import { Column, Entity, ManyToOne } from "typeorm";
/*@jotsamikael
*Tracks the status history of a request over time. Used for auditing, filtering, and supporting workflows like "pending", "accepted", "in_transit", etc.
*/
@Entity()
export class RequestStatusHistoryEntity extends BaseEntity{

    @Column()
    requestId: number

     @Column()
    requestStatusId: number

    @ManyToOne(()=>RequestStatusEntity,(reqStatus)=>reqStatus.requestStatusHistory)
    requestStatus:RequestStatusEntity;


    @ManyToOne(()=>RequestEntity,(r)=>r.requestStatusHistory)
    request: RequestEntity;
}