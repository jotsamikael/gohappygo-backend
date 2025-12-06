import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserController } from './user/user.controller';
import { UserModule } from './user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as joi from 'joi'
import appConfig from './config/appConfig';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UserEntity } from './user/user.entity';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { FileUploadModule } from './file-upload/file-upload.module';
import { File } from './file-upload/entities/file.entity';
import { EventsModule } from './events/events.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { DemandModule } from './demand/demand.module';
import { TravelModule } from './travel/travel.module';
import { RequestModule } from './request/request.module';
import { RoleModule } from './role/role.module';
import { ReviewModule } from './review/review.module';
import { TransactionModule } from './transaction/transaction.module';
import { RequestStatusModule } from './request-status/request-status.module';
import { RequestStatusHistoryModule } from './request-status-history/request-status-history.module';
import { DeliveryProofModule } from './delivery-proof/delivery-proof.module';
import { InsuranceModule } from './insurance/insurance.module';
import { LegalProtectionModule } from './legal-protection/legal-protection.module';
import { MessageModule } from './message/message.module';
import { UserRoleEntity } from './role/userRole.entity';
import { DemandEntity } from './demand/demand.entity';
import { RequestEntity } from './request/request.entity';
import { TravelEntity } from './travel/travel.entity';
import { TransactionEntity } from './transaction/transaction.entity';
import { RequestStatusEntity } from './request-status/requestStatus.entity';
import { RequestStatusHistoryEntity } from './request-status-history/RequestStatusHistory.entity';
import { DeliveyProofEntity } from './delivery-proof/delivery-proof.entity';
import { InsuranceEntity } from './insurance/insurance.entity';
import { MessageEntity } from './message/message.entity';
import { LegalProtectionEntity } from './legal-protection/legal-protection.entity';
import { UploadedFileModule } from './uploaded-file/uploaded-file.module';
import { UploadedFileEntity } from './uploaded-file/uploaded-file.entity';
import { UserVerificationAuditModule } from './user-verification-audit-entity/user-verification-audit.module';
import { ReviewEntity } from './review/review.entity';
import { UserVerificationAuditEntity } from './user-verification-audit-entity/user-verification-audit.entity';
import { AirportModule } from './airport/airport.module';
import { AirportEntity } from './airport/entities/airport.entity';
import { EmailModule } from './email/email.module';
import { AirlineModule } from './airline/airline.module';
import { FlightModule } from './flight/flight.module';
import { AirlineEntity } from './airline/entities/airline.entity';
import { FlightEntity } from './flight/entities/flight.entity';
import { EmailVerificationModule } from './email-verification/email-verification.module';
import { PhoneVerificationModule } from './phone-verification/phone-verification.module';
import { EmailVerificationEntity } from './email-verification/email-verification.entity';
import { PhoneVerificationEntity } from './phone-verification/phone-verification.entity';
import { DemandAndTravelModule } from './demand-and-travel/demand-and-travel.module';
import { KycDiditModule } from './kyc-didit/kyc-didit.module';
import { OnfidoKycModule } from './onfido-kyc/onfido-kyc.module';
import { QuoteModule } from './quote/quote.module';
import { FirebaseModule } from './firebase/firebase.module';
import { QuoteEntity } from './quote/entities/quote.entity';
import { CurrencyModule } from './currency/currency.module';
import { CurrencyEntity } from './currency/entities/currency.entity';
import { BookmarkModule } from './bookmark/bookmark.module';
import { BookmarkEntity } from './bookmark/entities/bookmark.entity';
import { CommonModule } from './common/common.module';
import { NotificationModule } from './notification/notification.module';
import { NotificationEntity } from './notification/entities/notification.entity';
import { SupportModule } from './support/support.module';
import { SupportRequestEntity } from './support/entities/support-request.entity';
import { SupportLogEntity } from './support/entities/support-log.entity';
import { PlatformPricingModule } from './platform-pricing/platform-pricing.module';
import { PlatformPricingEntity } from './platform-pricing/entities/platform-pricing.entity';

@Module({
  imports: [
    CommonModule,
    EmailModule,
    // Configuration Module - Load first
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV}`,
        '.env'
      ],
      validationSchema: joi.object({
        DB_HOST: joi.string().default('localhost'),
        DB_PORT: joi.number().default(3306),
        DB_USERNAME: joi.string().required(),
        DB_PASSWORD: joi.string().allow('').default(''),
        DB_DATABASE: joi.string().required(),
        PORT: joi.number().default(3000),
        BASE_URL: joi.string().optional(),
        NODE_ENV: joi.string().valid('development', 'production', 'test').default('development'),
      }),
      load: [appConfig]
    }),
    //Caching
    CacheModule.register({
      isGlobal: true,
      ttl: 30000,
      max: 100
    }),
    //Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 5
      }
    ]),
    //ORM - Use ConfigService to get environment variables
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [
          UserEntity, 
          UserRoleEntity,
           AirportEntity, 
           QuoteEntity, 
          DemandEntity, 
          RequestEntity,
          TravelEntity, 
          TransactionEntity,
          RequestStatusEntity,
           RequestStatusHistoryEntity,
          ReviewEntity,
           DeliveyProofEntity,
          InsuranceEntity,
           MessageEntity,
          LegalProtectionEntity, 
          EmailVerificationEntity,
          PhoneVerificationEntity,
          UploadedFileEntity,
           UserVerificationAuditEntity,
          AirlineEntity,
          FlightEntity,
          CurrencyEntity,
          File,
          BookmarkEntity,
          NotificationEntity,
          SupportRequestEntity,
          SupportLogEntity,
          PlatformPricingEntity
        ],
        synchronize: configService.get<string>('NODE_ENV') === 'development', // Only in dev mode
        logging: configService.get<string>('NODE_ENV') === 'development',
        
        // Add these connection pool settings
        extra: {
          connectionLimit: 15, // Moderate limit to prevent overwhelming remote DB
          connectTimeout: 60000, // 60 seconds
          acquireTimeout: 60000,
          timeout: 60000,
          reconnect: true, // Auto-reconnect on connection loss
          idleTimeout: 180000, // 3 minutes - close idle connections
          waitForConnections: true, // Wait for available connection instead of failing
          queueLimit: 0, // No limit on connection queue
          enableKeepAlive: true,        // ADD THIS
          keepAliveInitialDelay: 0,     // ADD THIS
          testOnBorrow: true,           // ADD THIS - validate before use
          reconnectDelay: 1000,
        },
        
        // Retry connection on failure
        retryAttempts: 10,
        retryDelay: 3000,
        
        // Keep connection alive
        keepConnectionAlive: true,
      }),
      inject: [ConfigService],
    }),
    UserModule, 
    AirlineModule, 
    AuthModule,
    FirebaseModule,
    QuoteModule,
    UserVerificationAuditModule,
    FileUploadModule, 
    EventsModule,
     DemandModule,
    TravelModule, 
    RequestModule, 
    RoleModule, 
    ReviewModule, 
    TransactionModule, 
    RequestStatusModule, 
    RequestStatusHistoryModule,
     DeliveryProofModule, 
    InsuranceModule, 
    LegalProtectionModule, MessageModule,
    EmailVerificationModule, 
    PhoneVerificationModule,
    UploadedFileModule, 
    UserVerificationAuditModule, 
    AirportModule, EmailModule,
     DemandAndTravelModule,
     AirlineModule, FlightModule,
      EmailVerificationModule,
      PhoneVerificationModule, KycDiditModule, OnfidoKycModule, CurrencyModule,
      BookmarkModule,
      NotificationModule,
      SupportModule,
      PlatformPricingModule
  ],
  controllers: [AppController, UserController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply middleware for all routes
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
