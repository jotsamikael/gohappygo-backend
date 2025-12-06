import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPhoneNumber, MinLength } from 'class-validator';

export class UpdatePhoneDto {
  @ApiProperty({
    description: 'Old phone number',
    example: '+1234567890',
    minLength: 1,
    maxLength: 15
  })
  @IsNotEmpty({ message: 'Old phone number can not be empty' })
  @IsPhoneNumber()
  oldPhoneNumber: string;

  @ApiProperty({
    description: 'New phone number',
    example: '+1234567890',
    minLength: 1,
    maxLength: 15
  })
  @IsNotEmpty({ message: 'New phone number can not be empty' })
  @IsPhoneNumber()
  @MinLength(6, { message: 'New phone number must be atleast 6 charcters' })
  newPhoneNumber: string;
}
