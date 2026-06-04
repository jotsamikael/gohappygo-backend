import { Global, Module } from '@nestjs/common';
import { CommonService } from './service/common.service';
import { VisibilityService } from './service/visibility.service';
import { CacheInvalidationService } from './service/cache-invalidation.service';

@Global()
@Module({
  providers: [CommonService, VisibilityService, CacheInvalidationService],
  exports: [CommonService, VisibilityService, CacheInvalidationService],
})
export class CommonModule {}

