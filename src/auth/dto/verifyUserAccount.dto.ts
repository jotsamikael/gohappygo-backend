import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class VerifyUserAccountDto {
  @ApiProperty({
    description: 'Approval status',
    example: true
  })
  @IsNotEmpty({ message: 'Approval status is mandatory' })
  approved: boolean;

  @ApiProperty({
    description: 'Reason for approval or rejection',
    example: 'Valid identification documents provided',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  @MinLength(2, { message: 'reason must be at least 2 characters' })
  @MaxLength(500, { message: 'reason cannot exceed 500 characters' })
  reason?: string;
}