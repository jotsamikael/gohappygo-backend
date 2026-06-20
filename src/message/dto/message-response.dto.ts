import { ApiProperty } from "@nestjs/swagger";

export class MessageResponseDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 'ms_01ARZ3NDEKTSV4RRFFQ69G5FAV' })
    publicId: string;

    @ApiProperty({ example: 'John' })
    content: string;
}

export class CreateMessageResponseDto {
    @ApiProperty({ example: 'Message created successfully' })
    message: string;
 
}
