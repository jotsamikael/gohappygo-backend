import { AirportEntity } from 'src/airport/entities/airport.entity';
import { BaseEntity } from 'src/baseEntity/base.entity';
import { UserEntity } from 'src/user/user.entity';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

export enum AlertType {
  DEMAND = 'DEMAND',
  TRAVEL = 'TRAVEL',
  BOTH = 'BOTH',
}

@Entity()
export class AlertEntity extends BaseEntity {

  @Column({ name: 'user_id', nullable: false })
  userId: number;

  @Column({ name: 'departure_airport', nullable: false })
  departureAirportId: number;

  @Column({ name: 'arrival_airport', nullable: false })
  arrivalAirportId: number;

  @Column({ name: 'alert_type', nullable: false, default: AlertType.TRAVEL})
  alertType: AlertType;

  @Column({ name: 'flight_number', type: 'varchar', length: 255, nullable: true })
  flightNumber: string | null;

  @Column({ name: 'travel_date', type: 'date', nullable: true })
  travelDate: Date | null;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => AirportEntity, { nullable: false })
  @JoinColumn({ name: 'departure_airport' })
  departureAirport: AirportEntity;
  
  @ManyToOne(() => AirportEntity, { nullable: false })
  @JoinColumn({ name: 'arrival_airport' })
  arrivalAirport: AirportEntity;
}
