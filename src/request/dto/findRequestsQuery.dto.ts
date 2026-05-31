import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, MaxLength, IsNumber, IsEmail } from "class-validator";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class FindRequestsQueryDto extends PaginationQueryDto {
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
        description: 'Filter by requester user ID (admin only)',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    requesterId?: number;

    @ApiProperty({
        description: 'Filter by travel ID',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    travelId?: number;

    @ApiProperty({
        description: 'Filter by demand ID',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    demandId?: number;

    @ApiProperty({
        description: 'Filter by request type',
        enum: ['GoAndGive', 'GoAndGo'],
        required: false
    })
    @IsOptional()
    @IsEnum(['GoAndGive', 'GoAndGo'])
    requestType?: string;

    @ApiProperty({
        description: 'Filter by package description',
        example: 'I need to send toys',
        required: false
    })
    @IsOptional()
    @IsString()
    @MaxLength(2500)
    packageDescription?: string;

    @ApiProperty({
        description: 'Filter by requesterEmail (admin only)',
        example: 'jamesward@gmail.com',
        minLength: 2,
        maxLength: 80,
        required: false
    })
    @IsOptional()
    @IsEmail()
    @MaxLength(50, { message: 'requesterEmail can not be more than 80 characters' })
    requesterEmail?: string;


    @ApiProperty({
        description: 'Filter by travelerEmail (admin only)',
        example: 'andycole@gmail.com',
        minLength: 2,
        maxLength: 80,
        required: false
    })
    @IsOptional()
    @IsEmail()
    @MaxLength(50, { message: 'travelerEmail can not be more than 80 characters' })
    travelerEmail?: string;


    @ApiProperty({
        description: 'Filter by minimum weight',
        example: 2.5,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    minWeight?: number;

    @ApiProperty({
        description: 'Filter by maximum weight',
        example: 10.0,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    maxWeight?: number;

    @ApiProperty({
        description: 'Filter by limit date (ISO 8601)',
        example: '2025-01-15T10:00:00Z',
        required: false
    })
    @IsOptional()
    @IsISO8601()
    limitDate?: string;

    @ApiProperty({
        description: 'Filter by grouped frontend status',
        enum: ['TO_CONFIRM', 'AWAITING_DELIVER', 'PROOF_ISSUE', 'FINISHED'],
        required: false
    })
    @IsOptional()
    @IsEnum(['TO_CONFIRM', 'AWAITING_DELIVER', 'PROOF_ISSUE', 'FINISHED'])
    status?: 'TO_CONFIRM' | 'AWAITING_DELIVER' | 'PROOF_ISSUE' | 'FINISHED';

    @ApiProperty({
        description: 'Sort order (field:direction)',
        example: 'createdAt:desc',
        enum: ['createdAt:asc', 'createdAt:desc', 'limitDate:asc', 'limitDate:desc', 'weight:asc', 'weight:desc'],
        required: false
    })
    @IsOptional()
    @IsString()
    orderBy?: string;
}
