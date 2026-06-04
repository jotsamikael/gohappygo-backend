import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AirlineService } from './airline.service';
import { AirlineController } from './airline.controller';
import { AirlineEntity } from './entities/airline.entity';
import { CloudinaryModule } from 'src/file-upload/cloudinary/cloudinary.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([AirlineEntity]), CloudinaryModule, CommonModule],
  controllers: [AirlineController],
  providers: [AirlineService],
  exports: [AirlineService]
})
export class AirlineModule {}
