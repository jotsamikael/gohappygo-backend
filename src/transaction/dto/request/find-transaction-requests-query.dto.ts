import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsISO8601, IsOptional, IsNumber, Min, IsString } from "class-validator";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class FindTransactionQueryDto extends PaginationQueryDto {
    @ApiProperty({
        description: 'Filter by transaction ID',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    id?: number;

    @ApiProperty({
        description: 'Filter by payer user ID (admin only)',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    payerId?: number;

    @ApiProperty({
        description: 'Filter by payee user ID (admin only)',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    payeeId?: number;

    @ApiProperty({
        description: 'Filter by request ID (admin only)',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    requestId?: number;

    @ApiProperty({
        description: 'Filter by minimum amount',
        example: 10.50,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minAmount?: number;

    @ApiProperty({
        description: 'Filter by maximum amount',
        example: 1000.00,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxAmount?: number;

    @ApiProperty({
        description: 'Filter by date (ISO 8601 format)',
        example: '2024-01-01',
        required: false
    })
    @IsOptional()
    @IsISO8601()
    date?: string;

    @ApiProperty({
        description: 'Filter by transaction status',
        enum: ['pending', 'paid', 'awaiting_transfer', 'refunded', 'cancelled'],
        required: false
    })
    @IsOptional()
    @IsEnum(['pending', 'paid', 'awaiting_transfer', 'refunded', 'cancelled'])
    status?: 'pending' | 'paid' | 'awaiting_transfer' | 'refunded' | 'cancelled';

    @ApiProperty({
        description: 'Sort order (field:direction)',
        example: 'createdAt:desc',
        required: false,
        default: 'createdAt:desc'
    })
    @IsOptional()
    @IsString()
    orderBy?: string = 'createdAt:desc';
}
