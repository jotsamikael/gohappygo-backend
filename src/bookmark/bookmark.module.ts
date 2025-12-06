import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookmarkService } from './bookmark.service';
import { BookmarkController } from './bookmark.controller';
import { BookmarkEntity } from './entities/bookmark.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { DemandEntity } from 'src/demand/demand.entity';
import { BookmarkMapper } from './bookmark.mapper';
import { TravelModule } from 'src/travel/travel.module';
import { DemandModule } from 'src/demand/demand.module';

@Module({
  imports: [TypeOrmModule.forFeature([BookmarkEntity]), TravelModule, DemandModule],
  controllers: [BookmarkController],
  providers: [BookmarkService, BookmarkMapper],
  exports: [BookmarkService],
})
export class BookmarkModule {}

