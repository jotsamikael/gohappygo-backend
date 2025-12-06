import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";

export class FindUsersQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Email of user',
    example: 'john.doe@example.com',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Email must be a string' })
  @MaxLength(100, { message: 'Email search can\'t be more than 100 characters' })
  email?: string;

  @ApiProperty({
    description: 'Phone of user',
    example: '697942923',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @MaxLength(100, { message: 'Phone search can\'t be more than 100 characters' })
  phone?: string;

  @ApiProperty({
    description: 'Is user\'s phone verified',
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
  isPhoneVerified?: boolean;

  @ApiProperty({
    description: 'Is user\'s account verified',
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
  isVerified?: boolean;

  @ApiProperty({
    description: 'Filter by role ID',
    example: 1,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roleId?: number;

  @ApiProperty({
    description: 'Filter users by verification status',
    required: false,
    example: true
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  isAwaitingVerification?: boolean;

  @ApiProperty({
    description: 'Filter by delivery date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
    required: false
  })
  @IsOptional()
  @IsISO8601()
  createdDate?: string;

  @ApiProperty({
    description: 'Sort order (field:direction)',
    example: 'createdAt:desc',
    enum: ['createdAt:asc', 'createdAt:desc', 'deliveryDate:asc', 'deliveryDate:desc', 'pricePerKg:asc', 'pricePerKg:desc'],
    required: false
  })
  @IsOptional()
  @IsString()
  orderBy?: string;
}