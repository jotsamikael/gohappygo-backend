import { BaseEntity } from "src/baseEntity/base.entity";
import { UserEntity } from "src/user/user.entity";
import { Column, ManyToOne, JoinColumn, Entity } from "typeorm";

/*@jotsamikael
*Represents a rating and optional comment left by one user about another, in the context of a specific request.
*Builds trust in the platform through feedback and reputation.
*/

@Entity()
export class ReviewEntity extends BaseEntity{
  @Column()
  reviewerId: number;

  @Column()
  revieweeId: number;

  @Column()
  requestId: number;

  // Change this to support decimals
  @Column('decimal', { precision: 2, scale: 1 })
  rating: number; // 1.0 to 5.0 (allows half stars: 1.0, 1.5, 2.0, 2.5, etc.)

  @Column({ type: 'text', nullable: true })
  comment: string;

  @ManyToOne(() => UserEntity, (user) => user.id)
  @JoinColumn({ name: 'reviewerId' })
  reviewer: UserEntity;

  @ManyToOne(() => UserEntity, (user) => user.id)
  @JoinColumn({ name: 'revieweeId' })
  reviewee: UserEntity;
}