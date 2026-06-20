import { ApiProperty } from "@nestjs/swagger";

export class DemandTravelAirlineResponseDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 'al_01ARZ3NDEKTSV4RRFFQ69G5FAV' })
    publicId: string;

    @ApiProperty({ example: 'Air France' })
    name: string;

    @ApiProperty({ example: 'AFR' })
    icaoCode: string;

    @ApiProperty({ example: 'AF' })
    iataCode: string;
    
    @ApiProperty({ example: 'AF' })
    prefix: string;

    @ApiProperty({ example: 'https://example.com/profile.jpg' })
    logoUrl: string | null;

}