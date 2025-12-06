import { Test, TestingModule } from '@nestjs/testing';
import { PlatformPricingController } from './platform-pricing.controller';
import { PlatformPricingService } from './platform-pricing.service';

describe('PlatformPricingController', () => {
  let controller: PlatformPricingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformPricingController],
      providers: [PlatformPricingService],
    }).compile();

    controller = module.get<PlatformPricingController>(PlatformPricingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
