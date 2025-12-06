import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class AirportResponseDto {
    @ApiProperty({ example: 1 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'KJFK' })
    @Expose()
    ident: string;

    @ApiProperty({ example: 'large_airport' })
    @Expose()
    type: string;

    @ApiProperty({ example: 'John F Kennedy International Airport' })
    @Expose()
    name: string;

    @ApiProperty({ example: 40.6413, nullable: true })
    @Expose()
    latitudeDeg: number;

    @ApiProperty({ example: -73.7781, nullable: true })
    @Expose()
    longitudeDeg: number;

    @ApiProperty({ example: 13, nullable: true })
    @Expose()
    elevationFt: number;

    @ApiProperty({ example: 'NA', nullable: true })
    @Expose()
    continent: string;

    @ApiProperty({ example: 'US', nullable: true })
    @Expose()
    isoCountry: string;

    @ApiProperty({ example: 'US-NY', nullable: true })
    @Expose()
    isoRegion: string;

    @ApiProperty({ example: 'New York', nullable: true })
    @Expose()
    municipality: string;

    @ApiProperty({ example: 'yes', nullable: true })
    @Expose()
    scheduledService: string;

    @ApiProperty({ example: 'KJFK', nullable: true })
    @Expose()
    icaoCode: string;

    @ApiProperty({ example: 'JFK', nullable: true })
    @Expose()
    iataCode: string;

    @ApiProperty({ example: 'KJFK', nullable: true })
    @Expose()
    gpsCode: string;

    @ApiProperty({ example: 'JFK', nullable: true })
    @Expose()
    localCode: string;

    @ApiProperty({ example: 'https://www.panynj.gov/airports/jfk.html', nullable: true })
    homeLink: string;

    @ApiProperty({ example: 'https://en.wikipedia.org/wiki/John_F._Kennedy_International_Airport', nullable: true })
    wikipediaLink: string;

    @ApiProperty({ example: 'JFK, Kennedy, New York airport', nullable: true })
    @Expose()
    keywords: string;

    @ApiProperty()  
    @Expose()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

export class CreateAirportResponseDto {
    @ApiProperty({ example: 'Airport created successfully' })
    message: string;

    @ApiProperty({ example: AirportResponseDto })
    airport: AirportResponseDto;
}

export class UpdateAirportResponseDto {
    @ApiProperty({ example: 'Airport updated successfully' })
    message: string;
}