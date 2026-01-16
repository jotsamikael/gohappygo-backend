import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageGateway } from './message.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageEntity } from './message.entity';
import { RequestEntity } from 'src/request/request.entity';
import { UserModule } from 'src/user/user.module';
import { RequestModule } from 'src/request/request.module';
import { JwtModule } from '@nestjs/jwt';
import { MessageMapper } from './message.mapper';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, RequestEntity]),
    UserModule,
    RequestModule,
    CacheModule.register(),
    JwtModule.register({
      secret: 'jwt_secret', // Same as your auth module
      signOptions: { expiresIn: '1440m' },
    }),
  ],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway, MessageMapper],
  exports: [MessageService],
})
export class MessageModule {}