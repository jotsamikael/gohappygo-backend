import { ApiProperty, PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional, IsDateString, Min, Max } from 'class-validator';
import { CreateTravelDto } from './createTravel.dto';

export class UpdateTravelDto extends PartialType(
  OmitType(CreateTravelDto, ['image1', 'image2'] as const)
) {
  // All fields from CreateTravelDto are optional except userId and status which are omitted
  // Additional validations can be added here if needed for specific update scenarios
  
  @ApiProperty({
    description: 'Total weight allowance in kg (if updating, weightAvailable will be adjusted)',
    example: 50.0,
    required: false
  })
  @IsOptional()
  totalWeightAllowance?: number;
}

