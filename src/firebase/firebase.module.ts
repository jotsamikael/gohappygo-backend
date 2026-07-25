import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseService } from './firebase.service';
import { FirebaseConfig } from './firebase.config';
import { FirebaseAuthService } from './firebase-auth.service';
import { FirebaseMessagingService } from './firebase-messaging.service';
import { UserEntity } from '../user/user.entity';
import { RoleModule } from '../role/role.module';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserEntity]),
    RoleModule,
  ],
  providers: [FirebaseConfig, FirebaseService, FirebaseAuthService, FirebaseMessagingService],
  exports: [FirebaseService, FirebaseAuthService, FirebaseMessagingService],
})
export class FirebaseModule {}
