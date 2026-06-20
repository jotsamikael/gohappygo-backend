import { PublicIdentifiableEntity } from "src/baseEntity/public-identifiable.entity";
import { PublicIdPrefix } from "src/common/public-id/public-id-prefix.enum";
import { RequestEntity } from "src/request/request.entity";
import { UserEntity } from "src/user/user.entity";
import { Column, Entity, ManyToOne } from "typeorm";


/*jotsamikael
*Represents chat messages exchanged between sender and traveler about a specific request.
*Helps ensure communication happens within the platform.
*/
@Entity()
export class MessageEntity extends PublicIdentifiableEntity {
  static publicIdPrefix = PublicIdPrefix.MESSAGE;
      

    @Column({ length: 2000 })
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