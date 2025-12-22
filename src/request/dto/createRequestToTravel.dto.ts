import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Matches, Length } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestToTravelDto {

  @ApiProperty({
    description: 'Travel id',
    example: 1,
    minLength: 1,
    maxLength: 10
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  travelId: number;

  @ApiProperty({
    description: 'Request type',
    example: 'GoAndGo',
    minLength: 1,
    maxLength: 10
  })
  @IsNotEmpty()
  requestType: 'GoAndGive' | 'GoAndGo';

  @ApiProperty({
    description: 'Weight needed for the request',
    example: 10,
    minLength: 1,
    maxLength: 10
  })  
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  weight: number;

  @ApiProperty({
    description: 'Stripe Payment Method ID (created on frontend using Stripe Elements)',
    example: 'pm_1234567890abcdef',
    required: false,
  })
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;

}
