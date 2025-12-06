import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewEntity } from './review.entity';
import { RequestEntity } from 'src/request/request.entity';
import { UserModule } from 'src/user/user.module';
import { CacheModule } from '@nestjs/cache-manager';
import { RequestModule } from 'src/request/request.module';
import { ReviewMapper } from './review.mapper';


@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewEntity, RequestEntity]),
    RequestModule,
    CacheModule.register(),
  ],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewMapper],
  exports: [ReviewService]
})
export class ReviewModule {}
