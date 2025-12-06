import { ApiProperty } from "@nestjs/swagger";

export class RequestStatusResponseDto{
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 'Pending' })
    status: string;

    @ApiProperty({ example: 'Pending' })
    label: string;
}