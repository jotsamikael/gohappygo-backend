import { Global, Module } from '@nestjs/common';
import { CommonService } from './service/common.service';
import { VisibilityService } from './service/visibility.service';

@Global()
@Module({
  providers: [CommonService, VisibilityService],
  exports: [CommonService, VisibilityService],
})
export class CommonModule {}

