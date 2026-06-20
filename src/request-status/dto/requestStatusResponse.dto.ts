import { ApiProperty } from "@nestjs/swagger";

export class RequestStatusResponseDto{
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 'rs_01ARZ3NDEKTSV4RRFFQ69G5FAV' })
    publicId: string;

    @ApiProperty({ example: 'Pending' })
    status: string;

    @ApiProperty({ example: 'Pending' })
    label: string;
}