import { Module } from '@nestjs/common';
import { DemandAndTravelController } from './demand-and-travel.controller';
import { DemandModule } from 'src/demand/demand.module';
import { TravelModule } from 'src/travel/travel.module';
import { AirportModule } from 'src/airport/airport.module';
import { AirlineModule } from 'src/airline/airline.module';
import { DemandAndTravelService } from './demand-and-travel.service';
import { DemandAndTravelMapper } from './demand-and-travel.mapper';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookmarkEntity } from 'src/bookmark/entities/bookmark.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  controllers: [DemandAndTravelController],
  imports:[DemandModule, TravelModule, AirportModule, AirlineModule, TypeOrmModule.forFeature([BookmarkEntity]), JwtModule.register({})],
  providers:[DemandAndTravelService, DemandAndTravelMapper],
  exports:[DemandAndTravelService]
})
export class DemandAndTravelModule {}
