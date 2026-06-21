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
import { TravelEntity } from 'src/travel/travel.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { EmailModule } from 'src/email/email.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, RequestEntity, TravelEntity, DemandEntity]),
    UserModule,
    RequestModule,
    EmailModule,
    CommonModule,
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