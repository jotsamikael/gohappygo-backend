// src/auth/dto/upload-verification.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadVerificationDto {
  @ApiProperty({
    description: 'Additional notes for verification',
    example: 'Please verify my identity documents',
    required: false
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}