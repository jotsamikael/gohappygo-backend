import { PartialType } from '@nestjs/swagger';
import { CreatePlatformPricingDto } from './create-platform-pricing.dto';

export class UpdatePlatformPricingDto extends PartialType(CreatePlatformPricingDto) {}
