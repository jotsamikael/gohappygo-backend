import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
/*
*jotsamikael
*Abstract class that provides common audit fields (id, createdAt, updatedAt, deletedAt, createdBy, updatedBy) 
*to be inherited by all entities. Ensures consistent tracking of entity lifecycle across the system.
*/
@Entity()
export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: number;

  @Column({ name: 'is_deactivated', default: false, type: 'boolean' })
  isDeactivated: boolean;
}
