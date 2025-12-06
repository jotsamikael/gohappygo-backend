import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({
        description: 'User email address',
        example: 'admin@gohappygo.com'
    })
    @IsEmail({}, { message: 'Provide a valid email' })
    email: string

    @ApiProperty({
        description: 'User password',
        example: 'password123',
        minLength: 6,
        maxLength: 16
    })
    @IsNotEmpty({ message: 'Title is required' })
    @MinLength(6, { message: 'Must be atleast 3 characters long' })
    @MaxLength(16, { message: 'Can not be more than 50 characters long' })
    password: string
}