import { Module } from '@nestjs/common';
import { UserVerificationAuditService } from './user-verification-audit.service';
import { UserVerificationAuditController } from './user-verification-audit.controller';
import { UserVerificationAuditEntity } from './user-verification-audit.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
   imports:[
                //Makes UserVerificationAuditEntity available for injection
                TypeOrmModule.forFeature([UserVerificationAuditEntity])
          ],
  controllers: [UserVerificationAuditController],
  providers: [UserVerificationAuditService],
  exports:[UserVerificationAuditService]
})
export class UserVerificationAuditModule {}
