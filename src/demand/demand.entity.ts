import { AirportEntity } from "src/airport/entities/airport.entity";
import { BaseEntity } from "src/baseEntity/base.entity";
import { RequestEntity } from "src/request/request.entity";
import { UserEntity } from "src/user/user.entity";
import { CurrencyEntity } from 'src/currency/entities/currency.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { UploadedFileEntity } from "src/uploaded-file/uploaded-file.entity";
import { PackageKind } from "./package-kind.enum";
import { BookmarkEntity } from 'src/bookmark/entities/bookmark.entity';
import { AirlineEntity } from "src/airline/entities/airline.entity";
/*
*jotsamikael
*Represents a delivery request posted by a sender (HappyExpéditeur) with origin, destination, weight, and desired delivery date. 
*/
@Entity()
export class DemandEntity extends BaseEntity{

  @Column()
  userId: number;

  @Column({ nullable: true })
  airlineId: number;

  @Column()
  description: string;
  
  @Column({nullable:true})
  flightNumber: string;

 // Add the foreign key columns
 @Column()
 departureAirportId: number;

 @Column()
 arrivalAirportId: number;

  @Column()
  travelDate: Date;

  @Column('decimal', { precision: 10, scale: 2 })
  weight: number;

  @Column('decimal', { precision: 10, scale: 2 })
  pricePerKg: number;

  @Column({ nullable: true })
  currencyId: number;

  @Column({ type: 'enum', enum: ['active', 'expired', 'cancelled','resolved'] })
  status: string;
  
  @Column({ type: 'enum', enum: PackageKind })
  packageKind: PackageKind;

 @ManyToOne(() => AirportEntity, { nullable: false })
 @JoinColumn({ name: 'departureAirportId' })
 departureAirport: AirportEntity;

 @ManyToOne(() => AirportEntity, { nullable: false })
 @JoinColumn({ name: 'arrivalAirportId' })
 arrivalAirport: AirportEntity;

  @ManyToOne(()=> UserEntity, (u)=> u.demands)
    user: UserEntity

  @OneToMany(()=> RequestEntity, (r)=>r.demand)
    requests: RequestEntity[]

  @OneToMany(() => UploadedFileEntity, (file) => file.demand)
  images: UploadedFileEntity[];

  @OneToMany(() => BookmarkEntity, (bookmark) => bookmark.demand)
  bookmarks: BookmarkEntity[];

  @ManyToOne(() => CurrencyEntity, { nullable: true })
  @JoinColumn({ name: 'currencyId' })
  currency: CurrencyEntity;

  @ManyToOne(() => AirlineEntity, { nullable: true })
  @JoinColumn({ name: 'airlineId' })
  airline: AirlineEntity;
}