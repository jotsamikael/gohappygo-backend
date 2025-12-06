import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class PaginationQueryDto{

    @ApiProperty({
        description: 'Page number for pagination',
        example: 1,
        minimum: 1,
        required: false,
        default: 1
    })
    @IsOptional()
    @Type(()=> Number)
    @IsInt({message: 'Page must be an integer'})
    @Min(1,{message: 'Page must be an integer'})
    page?: number = 1

    @ApiProperty({
        description: 'Number of items per page',
        example: 10,
        minimum: 1,
        maximum: 2000,
        required: false,
        default: 10
    })
    @IsOptional()
    @Type(()=> Number)
    @IsInt({message: 'Limit must be an integer'})
    @Min(1,{message: 'Limit must be an integer'})
    @Max(2000,{message: 'Limit must be an integer'})
    limit?: number = 10

}