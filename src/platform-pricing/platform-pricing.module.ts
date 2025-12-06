import { Module } from '@nestjs/common';
import { PlatformPricingService } from './platform-pricing.service';
import { PlatformPricingController } from './platform-pricing.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformPricingEntity } from './entities/platform-pricing.entity';
import { PlatformPricingMapper } from './plateform-pricing.mapper';
import { CommonModule } from 'src/common/common.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformPricingEntity]), CommonModule, CacheModule.register()],
  controllers: [PlatformPricingController],
  providers: [PlatformPricingService, PlatformPricingMapper],
  exports: [PlatformPricingService],
})
export class PlatformPricingModule {}
