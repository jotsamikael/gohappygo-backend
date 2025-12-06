import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { SupportCategory, SupportRequesterType } from '../entities/support-request.entity';

export class CreateSupportRequestDto {
  @ApiProperty({ 
    description: 'Email address of the requester', 
    example: 'user@example.com',
    type: String 
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ 
    description: 'Support request message', 
    example: 'I need help with...',
    type: String 
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @ApiProperty({ 
    description: 'Type of requester', 
    enum: SupportRequesterType,
    enumName: 'SupportRequesterType',
    example: SupportRequesterType.USER,
    type: String 
  })
  @IsEnum(SupportRequesterType)
  @IsNotEmpty()
  supportRequesterType: SupportRequesterType;

  @ApiProperty({ 
    description: 'Category of support request', 
    enum: SupportCategory,
    enumName: 'SupportCategory',
    example: SupportCategory.TECHNICAL,
    type: String 
  })
  @IsEnum(SupportCategory)
  @IsNotEmpty()
  supportCategory: SupportCategory;
}

