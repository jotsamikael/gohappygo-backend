import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SocialSignInDto {
  @ApiProperty({
    description: 'Firebase ID token from Google or Facebook sign-in',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsNotEmpty({ message: 'idToken is required' })
  @IsString()
  idToken: string;
}
