import { AirlineEntity } from "src/airline/entities/airline.entity";
import { BaseEntity } from "src/baseEntity/base.entity";
import { Column, Entity, ManyToOne, JoinColumn } from "typeorm";

@Entity()
export class FlightEntity extends BaseEntity {
  @Column()
  airlineId: number;

  @Column()
  flightNumber: string;

  @Column()
  departureCity: string;

  @Column()
  arrivalCity: string;


  @ManyToOne(() => AirlineEntity, airline => airline.flights)
  @JoinColumn({ name: 'airlineId' })
  airline: AirlineEntity;
}