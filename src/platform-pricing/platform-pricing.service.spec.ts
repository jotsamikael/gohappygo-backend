import { Test, TestingModule } from '@nestjs/testing';
import { PlatformPricingService } from './platform-pricing.service';

describe('PlatformPricingService', () => {
  let service: PlatformPricingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformPricingService],
    }).compile();

    service = module.get<PlatformPricingService>(PlatformPricingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
