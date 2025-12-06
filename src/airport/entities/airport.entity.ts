import { BaseEntity } from "src/baseEntity/base.entity";
import { Column, Entity, Index } from "typeorm";

@Entity()
@Index(['iataCode'], { unique: false, where: "iataCode IS NOT NULL" })
@Index(['icaoCode'], { unique: false, where: "icaoCode IS NOT NULL" })
export class AirportEntity extends BaseEntity {

    @Column({ type: 'varchar', length: 20, unique: true })
    ident: string;

    @Column({ type: 'varchar', length: 50 })
    type: string;
 
    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    latitudeDeg: number;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    longitudeDeg: number;

    @Column({ type: 'int', nullable: true })
    elevationFt: number;

    @Column({ type: 'varchar', length: 10, nullable: true })
    continent: string;

    @Column({ type: 'varchar', length: 10, nullable: true })
    isoCountry: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    isoRegion: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    municipality: string;

    @Column({ type: 'varchar', length: 10, nullable: true })
    scheduledService: string;

    @Column({ type: 'varchar', length: 10, nullable: true })
    icaoCode: string;

    @Column({ type: 'varchar', length: 10, nullable: true })
    iataCode: string;

    @Column({ type: 'varchar', length: 10, nullable: true })
    gpsCode: string;

    @Column({ type: 'varchar', length: 10, nullable: true })
    localCode: string;

    @Column({ type: 'text', nullable: true })
    homeLink: string;

    @Column({ type: 'text', nullable: true })
    wikipediaLink: string;

    @Column({ type: 'text', nullable: true })
    keywords: string;
}
