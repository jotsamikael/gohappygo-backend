import { AirportEntity } from "src/airport/entities/airport.entity";
import { BaseEntity } from "src/baseEntity/base.entity";
import { RequestEntity } from "src/request/request.entity";
import { UserEntity } from "src/user/user.entity";
import { UploadedFileEntity } from "src/uploaded-file/uploaded-file.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { BookmarkEntity } from 'src/bookmark/entities/bookmark.entity';
import { CurrencyEntity } from 'src/currency/entities/currency.entity';
import { AirlineEntity } from 'src/airline/entities/airline.entity';

/* @jotsamikael
*Represents a travel declaration posted by a traveler (HappyVoyageur), including flight and baggage availability details. Used in the GoAndGo service.
*
*/

@Entity()
export class TravelEntity extends BaseEntity {
  @Column()
  userId: number;

  @Column()
  description: string;


  @Column()
  flightNumber: string;

  @Column()
  isSharedWeight: boolean;

  @Column()
  isInstant: boolean;

  @Column()
  isAllowExtraWeight: boolean;

  @Column('decimal', { precision: 10, scale: 2 })
  feeForLateComer: number;

  @Column('decimal', { precision: 10, scale: 2 })
  feeForGloomy: number;

  @Column({ nullable: true })
  airlineId: number;

  @Column()
  departureAirportId: number;

  @Column()
  arrivalAirportId: number;


  @Column()
  departureDatetime: Date;


  @Column('decimal', { precision: 10, scale: 2 })
  totalWeightAllowance: number;

  @Column('decimal', { precision: 10, scale: 2 })
  weightAvailable: number;

  @Column('decimal', { precision: 10, scale: 2 })
  pricePerKg: number;

  @Column({ nullable: true })
  currencyId: number;

  @Column({ type: 'enum', enum: ['active', 'filled', 'cancelled'] })
  status: string;

  @ManyToOne(() => AirportEntity, { nullable: false })
  @JoinColumn({ name: 'departureAirportId' })
  departureAirport: AirportEntity;

  @ManyToOne(() => AirportEntity, { nullable: false })
  @JoinColumn({ name: 'arrivalAirportId' })
  arrivalAirport: AirportEntity;

  @ManyToOne(() => UserEntity, (u) => u.travels)
  user: UserEntity;

  @OneToMany(() => RequestEntity, (r) => r.demand)
  requests: RequestEntity[]

  // Add relationship to uploaded files
  @OneToMany(() => UploadedFileEntity, (file) => file.travel)
  images: UploadedFileEntity[];

  @OneToMany(() => BookmarkEntity, (bookmark) => bookmark.travel)
  bookmarks: BookmarkEntity[];

  @ManyToOne(() => CurrencyEntity, { nullable: true })
  @JoinColumn({ name: 'currencyId' })
  currency: CurrencyEntity;

  @ManyToOne(() => AirlineEntity, { nullable: true })
  @JoinColumn({ name: 'airlineId' })
  airline: AirlineEntity;
}