import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './auth-response.dto';


export class VerifyUserAccountResponseDto {
@ApiProperty({ example: 'User verification status updated successfully' })
  message: string;
  @ApiProperty({
    type: () => UserResponseDto,
    example: { id: 1, email: 'john.doe@example.com', fullName: 'John D.', isVerified: true },
  })
  user: UserResponseDto;
}
