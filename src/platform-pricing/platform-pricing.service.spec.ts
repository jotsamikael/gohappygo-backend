import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlatformPricingService } from './platform-pricing.service';
import { PlatformPricingEntity } from './entities/platform-pricing.entity';
import { PlatformPricingMapper } from './plateform-pricing.mapper';
import { TravelService } from '../travel/travel.service';

const mockTiers: PlatformPricingEntity[] = [
  { id: 9, lowerBound: 1, upperBound: 6, fee: 2 } as PlatformPricingEntity,
  { id: 2, lowerBound: 7, upperBound: 10, fee: 3 } as PlatformPricingEntity,
  { id: 3, lowerBound: 11, upperBound: 30, fee: 4 } as PlatformPricingEntity,
  { id: 4, lowerBound: 31, upperBound: 60, fee: 5 } as PlatformPricingEntity,
  { id: 5, lowerBound: 61, upperBound: 90, fee: 7 } as PlatformPricingEntity,
  { id: 6, lowerBound: 91, upperBound: 120, fee: 8 } as PlatformPricingEntity,
  { id: 10, lowerBound: 121, upperBound: 150, fee: 12 } as PlatformPricingEntity,
];

describe('PlatformPricingService', () => {
  let service: PlatformPricingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformPricingService,
        {
          provide: getRepositoryToken(PlatformPricingEntity),
          useValue: {
            find: jest.fn().mockResolvedValue(mockTiers),
          },
        },
        {
          provide: PlatformPricingMapper,
          useValue: {},
        },
        {
          provide: TravelService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PlatformPricingService>(PlatformPricingService);
  });

  describe('calculateFee', () => {
    it('returns fee 4 when amount is 10.2 (2kg x 5.1)', async () => {
      await expect(service.calculateFee(10.2)).resolves.toBe(4);
    });

    it('returns fee 2 when amount is 0.8', async () => {
      await expect(service.calculateFee(0.8)).resolves.toBe(2);
    });

    it('returns fee 3 when amount is exactly 10', async () => {
      await expect(service.calculateFee(10)).resolves.toBe(3);
    });

    it('returns fee 3 when amount is 8.3 (inside tier, no promotion needed)', async () => {
      await expect(service.calculateFee(8.3)).resolves.toBe(3);
    });

    it('returns fee 12 for amounts above highest tier but below 151', async () => {
      await expect(service.calculateFee(150.99)).resolves.toBe(12);
    });

    it('returns 0 for non-positive amounts', async () => {
      await expect(service.calculateFee(0)).resolves.toBe(0);
    });
  });

  describe('calculateTotalAmount', () => {
    it('uses tier fee for decimal gap amounts', async () => {
      const result = await service.calculateTotalAmount(10.2);
      expect(result.fee).toBe(4);
      expect(result.travelerPayment).toBe(10.2);
      expect(result.totalAmount).toBe(Number((10.2 + 4 + 0.8).toFixed(2)));
    });

    it('uses 15% fee rounded to nearest 0.5 for amounts >= 151', async () => {
      const result = await service.calculateTotalAmount(152);
      expect(result.fee).toBe(22.5);
      expect(result.travelerPayment).toBe(152);
    });

    it('uses tier fee for exact integer amounts', async () => {
      const result = await service.calculateTotalAmount(10);
      expect(result.fee).toBe(3);
    });
  });
});
