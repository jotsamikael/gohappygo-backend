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

  // Stripe-related fields
  @Column({ nullable: true })
  stripePaymentIntentId: string; // Stripe Payment Intent ID

  @Column({ nullable: true })
  stripeTransferId: string; // Stripe Transfer ID

  @Column({ length: 3, default: 'USD' })
  currencyCode: string; // Currency code (e.g., 'USD', 'EUR')

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  originalAmount: number; // Amount before conversion to USD

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  convertedAmount: number; // Amount in USD after conversion

  @ManyToOne(() => UserEntity, (user) => user.id)
  @JoinColumn({ name: 'payerId' })
  payer: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id)
  @JoinColumn({ name: 'payeeId' })
  payee: UserEntity;

@ManyToOne(()=>RequestEntity,(r)=>r.transactions)
    request: RequestEntity;
}