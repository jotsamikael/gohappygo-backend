import { ApiProperty } from "@nestjs/swagger";

export class TravelResponseDto {
    @ApiProperty({
        description: 'Title of the travel',
        example: 'Travel to London',
        minLength: 2,
        maxLength: 500
      })
      title: string;
    
      @ApiProperty({
        description: 'Flight number of the travel',
        example: 'BA123',
        minLength: 2,
        maxLength: 20
      })
      flightNumber: string;
    
      @ApiProperty({
        description: 'Airline of the travel',
        example: 'BA',
        minLength: 2,
        maxLength: 20
      })
      airline: string;
    
      @ApiProperty({
        description: 'Departure airport id',
        example: 1,
        minLength: 1,
        maxLength: 10
      })
      departureAirportId: number;
    
      @ApiProperty({
        description: 'Arrival airport id',
        example: 2,
        minLength: 1,
        maxLength: 10
      })
      arrivalAirportId: number;
    
      @ApiProperty({
        description: 'Departure datetime',
        example: '2025-01-01T10:00:00Z',
        minLength: 1,
        maxLength: 10
      })
      departureDatetime: Date;
    
      @ApiProperty({
        description: 'Arrival datetime',
        example: '2025-01-01T10:00:00Z',
        minLength: 1,
        maxLength: 10
      })
      arrivalDatetime: Date;
    
      @ApiProperty({
        description: 'Price per kg',
        example: 100,
        minLength: 1,
        maxLength: 10
      })
      pricePerKg: number;
    
      @ApiProperty({
        description: 'Total weight allowance',
        example: 100,
        minLength: 1,
        maxLength: 10
      })
      totalWeightAllowance: number;
}

export class CreateTravelResponseDto {  
    @ApiProperty({ example: 'Travel created successfully' })
    message: string;
    @ApiProperty({ example: TravelResponseDto })
    travel: TravelResponseDto;
}