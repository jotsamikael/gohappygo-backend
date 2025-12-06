// src/message/dto/send-message.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

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
    description: 'Receiver id',
    example: 1,
    minLength: 1,
    maxLength: 10
  })
  @IsNotEmpty()
  @IsNumber()
  receiverId: number;

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