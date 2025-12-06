// src/request/dto/create-request-to-demand.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestToDemandDto {
  @ApiProperty({
    description: 'Demand id',
    example: 1,
    minLength: 1,
    maxLength: 10
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  demandId: number;

  @ApiProperty({
    description: 'Request type',
    example: 'GoAndGo',
    minLength: 1,
    maxLength: 10
  })
  @IsNotEmpty()
  requestType: 'GoAndGive' | 'GoAndGo';

  @ApiProperty({
    description: 'Offer price',
    example: 10,
    minLength: 1,
    maxLength: 10
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  offerPrice: number;

  @ApiProperty({
    description: 'Limit date for the request (optional)',
    example: '2025-01-15T10:00:00Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  limitDate?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'First image file for the request'
  })
  @IsOptional()
  image1?: any;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Second image file for the request'
  })
  @IsOptional()
  image2?: any;
}