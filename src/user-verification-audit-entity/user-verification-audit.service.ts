import { Injectable } from '@nestjs/common';
import { UserEntity } from 'src/user/user.entity';
import {
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Repository,
} from 'typeorm';
import { UserVerificationAuditEntity } from './user-verification-audit.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { boolean } from 'joi';

@Injectable()
export class UserVerificationAuditService {
  constructor(@InjectRepository(UserVerificationAuditEntity) private userVerificationAuditRepository: Repository<UserVerificationAuditEntity>){}


 async record(isApproved:boolean, reason:string = '', user: UserEntity,admin: UserEntity){
   const userVerificationAudit = await this.userVerificationAuditRepository.create({
    isApproved: isApproved,  
    reason: reason,
        reviewedUser: user,
        verifiedBy:admin,
        createdAt: new Date()
    })

    await this.userVerificationAuditRepository.save(userVerificationAudit);
  }
}
