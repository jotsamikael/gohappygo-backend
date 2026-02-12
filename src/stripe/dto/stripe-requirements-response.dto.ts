import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class StripeRequirementsResponseDto {
  @ApiProperty({ 
    description: 'Whether the account has any requirements',
    example: true,
  })
  @Expose()
  hasRequirements: boolean;

  @ApiProperty({ 
    description: 'List of verification requirements that are currently due',
    example: ['verification.document.identity_document'],
    type: [String],
  })
  @Expose()
  currentlyDue: string[];

  @ApiProperty({ 
    description: 'List of verification requirements that are past due',
    example: [],
    type: [String],
  })
  @Expose()
  pastDue: string[];

  @ApiProperty({ 
    description: 'List of verification requirements that are eventually due',
    example: ['individual.verification.document'],
    type: [String],
  })
  @Expose()
  eventuallyDue: string[];
}
