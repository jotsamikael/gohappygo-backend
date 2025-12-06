import { ApiProperty } from "@nestjs/swagger";

export class AirlineResponseDto {
    @ApiProperty({ example: 1 })
    id: number;

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