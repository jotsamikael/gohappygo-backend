import { Module } from '@nestjs/common';
import { DeliveryProofController } from './delivery-proof.controller';
import { DeliveryProofService } from './delivery-proof.service';

@Module({
  controllers: [DeliveryProofController],
  providers: [DeliveryProofService]
})
export class DeliveryProofModule {}
