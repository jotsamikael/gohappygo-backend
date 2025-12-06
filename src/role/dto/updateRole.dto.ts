

// create-user-role.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'Name of the role',
    example: 'User',
    minLength: 1,
    maxLength: 50
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'Code of the role',
    example: 'USER',
    minLength: 1,
    maxLength: 30
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  code: string; // e.g., 'USER', 'ADMIN', etc.

  @ApiProperty({
    description: 'Description of the role',
    example: 'This is a description',
    minLength: 1,
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description: string;
}
