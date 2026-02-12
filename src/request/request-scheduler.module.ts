import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestSchedulerService } from './request-scheduler.service';
import { RequestEntity } from './request.entity';
import { UserEntity } from 'src/user/user.entity';
import { RequestModule } from './request.module';
import { RequestStatusModule } from 'src/request-status/request-status.module';
import { UserModule } from 'src/user/user.module';
import { RoleModule } from 'src/role/role.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RequestEntity, UserEntity]),
    RequestModule,
    RequestStatusModule,
    UserModule,
    RoleModule,
    EmailModule,
  ],
  providers: [RequestSchedulerService],
  exports: [RequestSchedulerService],
})
export class RequestSchedulerModule {}
