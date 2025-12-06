import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateDemandDto } from "./createDemand.dto";

export class UpdateDemandDto extends PartialType(
  OmitType(CreateDemandDto, ['image1', 'image2', 'image3'] as const)
) {
  // All fields from CreateDemandDto are optional except userId and status which are omitted
  // Images are excluded as they should be handled separately if needed
  // Status should not be directly updatable via this DTO
}