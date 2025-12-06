import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseService } from './firebase.service';
import { FirebaseConfig } from './firebase.config';
import { FirebaseAuthService } from './firebase-auth.service';
import { UserEntity } from '../user/user.entity';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserEntity])
  ],
  providers: [FirebaseConfig, FirebaseService, FirebaseAuthService],
  exports: [FirebaseService, FirebaseAuthService],
})
export class FirebaseModule {}
