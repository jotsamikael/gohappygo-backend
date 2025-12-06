import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RespondSupportRequestDto {
  @ApiProperty({ description: 'Response message', example: 'Thank you for contacting us...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}

