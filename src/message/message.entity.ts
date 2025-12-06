import { BaseEntity } from "src/baseEntity/base.entity";
import { RequestEntity } from "src/request/request.entity";
import { UserEntity } from "src/user/user.entity";
import { Column, Entity, ManyToOne } from "typeorm";


/*jotsamikael
*Represents chat messages exchanged between sender and traveler about a specific request.
*Helps ensure communication happens within the platform.
*/
@Entity()
export class MessageEntity extends BaseEntity{
      

    @Column()
    content: string;

    @Column({ default: false })
    isRead: boolean;

    @ManyToOne(()=>UserEntity, (r)=>r.messagesSend)
    sender: UserEntity;

    @ManyToOne(()=>UserEntity, (r)=>r.messagesReceived)
    receiver: UserEntity;


    @ManyToOne(()=>RequestEntity, (r)=>r.messages)
    request: RequestEntity;
}