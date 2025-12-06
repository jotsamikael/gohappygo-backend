import { BaseEntity } from "src/baseEntity/base.entity";
import { FlightEntity } from "src/flight/entities/flight.entity";
import { Column, Entity, OneToMany } from "typeorm";

@Entity()
export class AirlineEntity extends BaseEntity {
  @Column({ unique: true })
  icaoCode: string;

  @Column({ nullable: true })
  iataCode: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  prefix: string;

  @Column({ nullable: true })
  fleetSize: number;

  @Column({ nullable: true })
  destinationsCount: number;

  @Column({ nullable: true })
  callsign: string;

  @Column({ nullable: true })
  wikipediaUrl: string;

  @OneToMany(() => FlightEntity, flight => flight.airline)
  flights: FlightEntity[];
}