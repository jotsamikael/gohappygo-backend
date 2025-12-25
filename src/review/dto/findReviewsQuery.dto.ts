import { ApiProperty } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, MaxLength, IsNumber, IsBoolean } from "class-validator";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class FindReviewsQueryDto extends PaginationQueryDto {
    @ApiProperty({
        description: 'Filter by request ID',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    id?: number;

    @ApiProperty({
        description: 'Filter by reviewerId user ID (reviews given by this user)',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    reviewerId?: number;

    @ApiProperty({
        description: 'Filter by reviewee user ID (reviews received by this user)',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    revieweeId?: number;

    @ApiProperty({
        description: 'Filter by request ID',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    requestId?: number;
    @ApiProperty({
        description: 'Filter by rating',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    rating?: number;
    @ApiProperty({
        description: 'Filter by comment',
        example: 'This is a comment',
        required: false
    })
    @IsOptional()
    @IsString()

    comment?: string;
    @ApiProperty({
        description: 'Filter by createdAt',
        example: '2025-01-01',
        required: false
    })
    @IsOptional()
    @IsISO8601()
    createdAt?: string;

    @ApiProperty({
        description: 'Filter by orderBy',
        example: 'createdAt:desc',
        required: false
    })
    @IsOptional()
    @IsString()
    orderBy?: string;

    @ApiProperty({
        description: 'Filter to only show reviews where the current user is the reviewer (reviews they posted)',
        example: true,
        required: false
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    @IsBoolean()
    asReviewer?: boolean;
}