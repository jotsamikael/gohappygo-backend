import { ApiProperty } from "@nestjs/swagger";
import { AirlineResponseDto } from "src/airline/dto/airline-response.dto";

export class FlightResponseDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 'Paris' })
    departureCity: string;

    @ApiProperty({ example: 'Paris' })
    arrivalCity: string;

    airline: AirlineResponseDto;
}