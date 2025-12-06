import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class CurrencyResponseDto {
    @ApiProperty({
        description: 'Currency ID',
        example: 1,
        minLength: 1,
        maxLength: 10
    })
    @Expose()
    id: number;

    @ApiProperty({
        description: 'Currency name',
        example: 'USD',
        minLength: 1,
        maxLength: 10
    })
    @Expose()
    name: string;
    
    @ApiProperty({
        description: 'Currency symbol',
        example: '$',
        minLength: 1,
        maxLength: 10
    })
    @Expose()
    symbol: string;
    
    @ApiProperty({
        description: 'Currency code',
        example: 'USD',
        minLength: 1,
        maxLength: 10
    })
    @Expose()
    code: string;
    
    
}