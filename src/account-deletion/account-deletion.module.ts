import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionAuditEntity } from './account-deletion-audit.entity';
import { UserEntity } from 'src/user/user.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { RequestEntity } from 'src/request/request.entity';
import { BookmarkEntity } from 'src/bookmark/entities/bookmark.entity';
import { AlertEntity } from 'src/alert/entities/alert.entity';
import { MessageEntity } from 'src/message/message.entity';
import { EmailVerificationEntity } from 'src/email-verification/email-verification.entity';
import { PhoneVerificationEntity } from 'src/phone-verification/phone-verification.entity';
import { PasswordResetEntity } from 'src/password-reset/password-reset.entity';
import { NotificationEntity } from 'src/notification/entities/notification.entity';
import { SupportRequestEntity } from 'src/support/entities/support-request.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { DemandModule } from 'src/demand/demand.module';
import { TravelModule } from 'src/travel/travel.module';
import { FileUploadModule } from 'src/file-upload/file-upload.module';
import { NotificationModule } from 'src/notification/notification.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      DemandEntity,
      TravelEntity,
      RequestEntity,
      BookmarkEntity,
      AlertEntity,
      MessageEntity,
      EmailVerificationEntity,
      PhoneVerificationEntity,
      PasswordResetEntity,
      NotificationEntity,
      SupportRequestEntity,
      TransactionEntity,
      AccountDeletionAuditEntity,
    ]),
    DemandModule,
    TravelModule,
    FileUploadModule,
    NotificationModule,
    EmailModule,
  ],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
