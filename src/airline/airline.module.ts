import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AirlineService } from './airline.service';
import { AirlineController } from './airline.controller';
import { AirlineEntity } from './entities/airline.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AirlineEntity])],
  controllers: [AirlineController],
  providers: [AirlineService],
  exports: [AirlineService]  // Add this if not already there
})
export class AirlineModule {}
