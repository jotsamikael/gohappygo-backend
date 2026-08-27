import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Optional reason for account deletion' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Must match the authenticated user email when provided',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  confirmEmail?: string;
}
