import { BaseEntity } from 'src/baseEntity/base.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { UserEntity } from 'src/user/user.entity';
import { Column, Entity, ManyToOne, JoinColumn, Index } from 'typeorm';

export enum BookmarkType {
  TRAVEL = 'TRAVEL',
  DEMAND = 'DEMAND',
}

/*
 * Represents a bookmark/favorite created by a user
 * Can bookmark either a travel or a demand
 */
@Entity()
@Index(['userId', 'bookmarkType', 'travelId', 'demandId'], { unique: true }) // Prevent duplicate bookmarks
export class BookmarkEntity extends BaseEntity {
  @Column({ nullable: false })
  userId: number;
  
  @Column({
    type: 'enum',
    enum: BookmarkType,
  })
  bookmarkType: BookmarkType;

  @Column({ nullable: true })
  travelId: number;

  @Column({ nullable: true })
  demandId: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
  @ManyToOne(() => UserEntity, (user) => user.bookmarks)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => TravelEntity, { nullable: true })
  @JoinColumn({ name: 'travelId' })
  travel: TravelEntity;

  @ManyToOne(() => DemandEntity, { nullable: true })
  @JoinColumn({ name: 'demandId' })
  demand: DemandEntity;
}
