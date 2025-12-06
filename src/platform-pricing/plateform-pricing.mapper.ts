import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PlatformPricingResponseDto } from './dto/platform-pricing-response.dto';
import { PlatformPricingEntity } from './entities/platform-pricing.entity';

@Injectable()
export class PlatformPricingMapper {
  toPlatformPricingResponse(
    pricing: PlatformPricingEntity,
  ): PlatformPricingResponseDto {
    return plainToInstance(PlatformPricingResponseDto, pricing, {
      excludeExtraneousValues: true,
    });
  }

  toPlatformPricingResponseList(
    pricings: PlatformPricingEntity[],
  ): PlatformPricingResponseDto[] {
    return pricings.map((pricing) => this.toPlatformPricingResponse(pricing));
  }
}
