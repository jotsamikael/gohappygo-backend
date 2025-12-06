import { DemandEntity } from "src/demand/demand.entity";
import { TravelEntity } from "src/travel/travel.entity";
import { UserEntity } from "src/user/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class File{
    @PrimaryGeneratedColumn('uuid')
    id: string;
    
    @Column()
    originalName: string;

    @Column()
    mimeType: string

      @Column()
    size: number

      @Column()
    url: string

      @Column()
    publicId: string

      @Column({nullable:true})
    description: string

      @ManyToOne(()=>UserEntity, {eager: true})
     uploader: UserEntity

      @ManyToOne(()=>TravelEntity, {eager: true})
      travel: TravelEntity

      @ManyToOne(()=>DemandEntity, {eager: true})
      demand: DemandEntity

     @CreateDateColumn()
     createdAt: Date;
}