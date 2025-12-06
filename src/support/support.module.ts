import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportRequestEntity } from './entities/support-request.entity';
import { SupportLogEntity } from './entities/support-log.entity';
import { SupportMapper } from './support.mapper';
import { UserEntity } from '../user/user.entity';
import { EmailModule } from '../email/email.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportRequestEntity, SupportLogEntity, UserEntity]),
    EmailModule,
    CommonModule,
  ],
  controllers: [SupportController],
  providers: [SupportService, SupportMapper],
  exports: [SupportService],
})
export class SupportModule {}
