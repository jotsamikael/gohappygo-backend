import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DeliveryProofController } from './delivery-proof.controller';
import { DeliveryProofService } from './delivery-proof.service';
import { DeliveyProofEntity } from './delivery-proof.entity';
import { RequestEntity } from 'src/request/request.entity';
import { CloudinaryModule } from 'src/file-upload/cloudinary/cloudinary.module';
import { EventsModule } from 'src/events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeliveyProofEntity, RequestEntity]),
    CloudinaryModule,
    ConfigModule,
    EventsModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [DeliveryProofController],
  providers: [DeliveryProofService],
  exports: [DeliveryProofService],
})
export class DeliveryProofModule {}
