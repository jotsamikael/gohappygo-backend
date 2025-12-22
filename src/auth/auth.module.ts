import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/user.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { RequestEntity } from 'src/request/request.entity';
import { BookmarkEntity } from 'src/bookmark/entities/bookmark.entity';
import { ReviewEntity } from 'src/review/review.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { Passport } from 'passport';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles-guard';
import { EventsModule } from 'src/events/events.module';
import { UserService } from 'src/user/user.service';
import { RoleService } from 'src/role/role.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { UserVerificationAuditService } from 'src/user-verification-audit-entity/user-verification-audit.service';
import { UserModule } from 'src/user/user.module';
import { RoleModule } from 'src/role/role.module';
import { FileUploadModule } from 'src/file-upload/file-upload.module';
import { UserVerificationAuditModule } from 'src/user-verification-audit-entity/user-verification-audit.module';
import { EmailVerificationModule } from 'src/email-verification/email-verification.module';
import { PhoneVerificationModule } from 'src/phone-verification/phone-verification.module';
import { EmailModule } from 'src/email/email.module';
import { SmsModule } from 'src/sms/sms.module';
import { CurrencyModule } from 'src/currency/currency.module';
import { DemandModule } from 'src/demand/demand.module';
import { TravelModule } from 'src/travel/travel.module';
import { StripeModule } from 'src/stripe/stripe.module';

@Module({
  imports: [
    //events module
    EventsModule,

    // repositories available in the current scope
    TypeOrmModule.forFeature([
      UserEntity, 
      DemandEntity, 
      TravelEntity, 
      RequestEntity,
      BookmarkEntity,
      ReviewEntity,
      TransactionEntity
    ]),

    //passport module
    PassportModule,

    //configure jwt
    JwtModule.register({}),
    UserModule,
    CurrencyModule,
    TravelModule,
    DemandModule,
    EmailVerificationModule,
    PhoneVerificationModule,
    RoleModule,
    FileUploadModule,
    UserVerificationAuditModule,
    SmsModule,
    EmailModule,
    PhoneVerificationModule,
    StripeModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard], //jwt strategy, roles guard
  exports: [AuthService] //role -> guard
})
export class AuthModule { }
