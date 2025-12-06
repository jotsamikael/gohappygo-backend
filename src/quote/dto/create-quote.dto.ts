import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty } from "class-validator";

export class CreateQuoteDto {
    @ApiProperty({
        description: 'Quote',
        example: 'Quote',
        minLength: 1,
        maxLength: 250
    })
    @IsNotEmpty()
    quote: string;

    @ApiProperty({
        description: 'Author',
        example: 'Author',
        minLength: 1,
        maxLength: 50
    })
    @IsNotEmpty()
    author: string;

    @ApiProperty({
        description: 'Font family',
        example: 'Arial',
        minLength: 1,
        maxLength: 50
    })
    @IsNotEmpty()
    fontFamily: string;

    @ApiProperty({
        description: 'Font size',
        example: '16',
        minLength: 1,
        maxLength: 50
    })
    @IsNotEmpty()
    fontSize: string;
}
