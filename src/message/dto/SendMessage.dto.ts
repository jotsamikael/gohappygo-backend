// src/message/dto/send-message.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Request id',
    example: 1,
    minLength: 1,
    maxLength: 10
  })
  @IsNotEmpty()
  @IsNumber()
  requestId: number;

  @ApiProperty({
    description: 'Receiver id (optional - will be determined automatically from request)',
    example: 1,
    minLength: 1,
    maxLength: 10,
    required: false
  })
  @IsOptional()
  @IsNumber()
  receiverId?: number; // Make optional since we determine it automatically

  @ApiProperty({
    description: 'Message content',
    example: 'Hello, how are you?',
    minLength: 1,
    maxLength: 1000
  })
  @IsNotEmpty()
  @IsString()
  content: string;
}