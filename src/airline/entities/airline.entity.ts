import { PublicIdentifiableEntity } from "src/baseEntity/public-identifiable.entity";
import { PublicIdPrefix } from "src/common/public-id/public-id-prefix.enum";
import { FlightEntity } from "src/flight/entities/flight.entity";
import { Column, Entity, OneToMany } from "typeorm";

@Entity()
export class AirlineEntity extends PublicIdentifiableEntity {
  static publicIdPrefix = PublicIdPrefix.AIRLINE;
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