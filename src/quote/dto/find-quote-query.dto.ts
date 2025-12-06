import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class FindQuoteQueryDto  extends PaginationQueryDto {
    @ApiProperty({
        description: 'Quote',
        example: 'Lost',
        minLength: 1,
        maxLength: 250,
        required: false
    })
    @IsOptional()
    quote?: string;

    @ApiProperty({
        description: 'Author',
        example: 'Tolkien',
        minLength: 1,
        maxLength: 50,
        required: false

    })
    @IsOptional()
    author?: string;

    @ApiProperty({
        description: 'Font family',
        example: 'Times New Roman',
        minLength: 1,
        maxLength: 50,
        required: false

    })
    @IsOptional()
    fontFamily?: string;

    @ApiProperty({
        description: 'Font size',
        example: '16',
        required: false

    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    fontSize?: number;

    @ApiProperty({
        description: 'Sort order (field:direction)',
        example: 'createdAt:desc',
        enum: ['createdAt:asc', 'createdAt:desc', 'fontFamily:asc', 'fontFamily:desc', 'fontSize:asc', 'fontSize:desc'],
        required: false
    })
    @IsOptional()
    @IsString()
    orderBy?: string;
}