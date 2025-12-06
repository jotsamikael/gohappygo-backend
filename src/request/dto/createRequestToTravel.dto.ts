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
    description: 'Card number',
    example: '4111111111111111',
    minLength: 13,
    maxLength: 19
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+$/, { message: 'Card number must contain only digits' })
  @Length(13, 19, { message: 'Card number must be between 13 and 19 digits' })
  cardNumber: string;

  @ApiProperty({
    description: 'Card expiry date in MM/YY format',
    example: '12/25',
    pattern: '^(0[1-9]|1[0-2])/\\d{2}$'
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/, { 
    message: 'Expiry date must be in MM/YY format (e.g., 12/25)' 
  })
  expiryDate: string;

  @ApiProperty({
    description: 'Card Verification Code (CVC)',
    example: '123',
    minLength: 3,
    maxLength: 4
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d+$/, { message: 'CVC must contain only digits' })
  @Length(3, 4, { message: 'CVC must be 3 or 4 digits' })
  cvc: string;

}
