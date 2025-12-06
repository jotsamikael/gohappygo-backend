import { BaseEntity } from "src/baseEntity/base.entity";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";


/**
 * @jotsamikael
 * Represents the pricing for a request amount
 * e.g For request between 1-6€, requester pays 2€...
 */
@Entity()
export class PlatformPricingEntity extends BaseEntity {

    @Column()
    lowerBound: number; //lower bound of the price range

    @Column()
    upperBound: number; //upper bound of the price range

    @Column({type: 'decimal', precision: 10, scale: 1})
    fee: number; // in percentage
}
