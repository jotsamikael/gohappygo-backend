import { UserEntity } from "src/user/user.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { SupportRequestEntity } from "./support-request.entity";

@Entity()
export class SupportLogEntity  {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    supportRequestId: number;

    @Column()
    message: string;

    @Column()
    isRead: boolean; // Whether the log has been read by the user

    @Column()
    isGohappyGoTeam: boolean; // Whether the messsage is from the GoHappyGo Team or requester

  @Column()
  createdAt: Date;

  @Column({ type: 'int', nullable: true })
  userId: number | null; // The user who created the log (nullable for visitors)

    @ManyToOne(() => SupportRequestEntity, (supportRequest) => supportRequest.logs)
    @JoinColumn({ name: 'supportRequestId' })
    supportRequest: SupportRequestEntity;
}