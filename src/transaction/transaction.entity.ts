import { BaseEntity } from "src/baseEntity/base.entity";
import { RequestEntity } from "src/request/request.entity";
import { UserEntity } from "src/user/user.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from "typeorm";

/*@jotsamikael
*Represents a payment made for a request (e.g., delivery fee, insurance). 
*Records payer, payee, amount, and payment method.
*/
@Entity()
export class TransactionEntity extends BaseEntity{
  @Column()
  payerId: number;

  @Column()
  payeeId: number;

  @Column()
  requestId: number;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'refunded', 'cancelled'],
    default: 'pending',
  })
  status: 'pending' | 'paid' | 'refunded' | 'cancelled';

  @Column({ length: 50 })
  paymentMethod: string; // e.g., 'stripe', 'paypal', 'mobile_money'

  @ManyToOne(() => UserEntity, (user) => user.id)
  @JoinColumn({ name: 'payerId' })
  payer: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id)
  @JoinColumn({ name: 'payeeId' })
  payee: UserEntity;

@ManyToOne(()=>RequestEntity,(r)=>r.transactions)
    request: RequestEntity;
}