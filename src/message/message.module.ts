import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageGateway } from './message.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageEntity } from './message.entity';
import { UserModule } from 'src/user/user.module';
import { RequestModule } from 'src/request/request.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity]),
    UserModule,
    RequestModule,
    JwtModule.register({
      secret: 'jwt_secret', // Same as your auth module
      signOptions: { expiresIn: '60m' },
    }),
  ],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway],
  exports: [MessageService],
})
export class MessageModule {}