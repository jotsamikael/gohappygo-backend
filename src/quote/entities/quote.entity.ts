import { BaseEntity } from "src/baseEntity/base.entity";
import { Column, Entity } from "typeorm";

@Entity()
export class QuoteEntity extends BaseEntity {

    @Column()
    quote: string;

    @Column()
    author: string;

    @Column()
    fontFamily: string;

    @Column()
    fontSize: string;  
}
