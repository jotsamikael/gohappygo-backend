import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength, MaxLength, IsOptional, IsNumber, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { PackageKind } from "../package-kind.enum";

export class CreateDemandDto{

    @ApiProperty({
      description: 'Flight number of the demand',
      example: 'BA2741',
      minLength: 2,
      maxLength: 50
    })
    @IsOptional()
    @IsString()
    flightNumber: string;
  
    @ApiProperty({
      description: 'Description of the demand',
      example: 'I need to send a package from New York to London',
      minLength: 2,
      maxLength: 2500
    })
    @IsNotEmpty({ message: 'description can not be empty' })
    @IsString({ message: 'description must be a string' })
    @MinLength(2, { message: 'description must be atleast 2 charcters' })
    @MaxLength(2500, { message: 'description can not exceed 2500 charcters' })
    description: string;
  
    @ApiProperty({
      description: 'Departure airport id',
      example: 100,
      type: 'number'
    })
    @IsNotEmpty({ message: 'departureAirportId can not be empty' })
    @Type(() => Number)
    @IsNumber({}, { message: 'departureAirportId must be a number' })
    departureAirportId: number;
  
    @ApiProperty({
      description: 'Arrival airport id',
      example: 200,
      type: 'number'
    })
    @IsNotEmpty({ message: 'arrivalAirportId can not be empty' })
    @Type(() => Number)
    @IsNumber({}, { message: 'arrivalAirportId must be a number' })
    arrivalAirportId: number;
  
    @ApiProperty({
      description: 'Travel date',
      example: '2025-01-01',
      type: 'string'
    })
    @IsNotEmpty({ message: 'Travel date can not be empty' })
    @IsString({ message: 'Travel date must be a string' })
    travelDate: string;
  
    @ApiProperty({
      description: 'Weight of the demand',
      example: 5,
      type: 'number'
    })
    @IsNotEmpty({ message: 'weight can not be empty' })
    @Type(() => Number)
    @IsNumber({}, { message: 'weight must be a number' })
    weight: number;
  
    @ApiProperty({
      description: 'Price per kg',
      example: 2.5,
      type: 'number'
    })
    @IsNotEmpty({ message: 'pricePerKg can not be empty' })
    @Type(() => Number)
    @IsNumber({}, { message: 'pricePerKg must be a number' })
    pricePerKg: number;

    @ApiProperty({
      description: 'Currency ID associated with this demand',
      example: 1,
      type: 'number'
    })
    @IsNotEmpty({ message: 'currencyId can not be empty' })
    @Type(() => Number)
    @IsNumber({}, { message: 'currencyId must be a number' })
    currencyId: number;

    @ApiProperty({
      description: 'Package kind',
      example: 'FRAGILE',
      enum: PackageKind
    })
    @IsNotEmpty({ message: 'packageKind can not be empty' })
    @IsEnum(PackageKind, { message: 'packageKind must be a valid package kind' })
    packageKind: PackageKind;

    @ApiProperty({
      type: 'string',
      format: 'binary',
      description: 'First image file for the demand'
    })
    @IsOptional()
    image1?: any;

    @ApiProperty({
      type: 'string',
      format: 'binary',
      description: 'Second image file for the demand'
    })
    @IsOptional()
    image2?: any;

    @ApiProperty({
      type: 'string',
      format: 'binary',
      description: 'Third image file for the demand'
    })
    @IsOptional()
    image3?: any;
}