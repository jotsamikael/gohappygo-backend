import { Module } from '@nestjs/common';
import { LegalProtectionController } from './legal-protection.controller';
import { LegalProtectionService } from './legal-protection.service';

@Module({
  controllers: [LegalProtectionController],
  providers: [LegalProtectionService]
})
export class LegalProtectionModule {}
