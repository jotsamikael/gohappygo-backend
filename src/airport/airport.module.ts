import { Module } from '@nestjs/common';
import { AirportService } from './airport.service';
import { AirportController } from './airport.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AirportEntity } from './entities/airport.entity';

@Module({
  imports:[TypeOrmModule.forFeature([AirportEntity])],
  controllers: [AirportController],
  providers: [AirportService],
})
export class AirportModule {}
