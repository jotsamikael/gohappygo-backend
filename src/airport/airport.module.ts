import { Module } from '@nestjs/common';
import { AirportService } from './airport.service';
import { AirportController } from './airport.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AirportEntity } from './entities/airport.entity';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([AirportEntity]), CommonModule],
  controllers: [AirportController],
  providers: [AirportService],
  exports: [AirportService],
})
export class AirportModule {}
