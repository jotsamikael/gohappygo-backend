import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './auth-response.dto';


export class VerifyUserAccountResponseDto {
@ApiProperty({ example: 'User verification status updated successfully' })
  message: string;
  @ApiProperty({ example: { id: 1, email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', isVerified: true } })
  @ApiProperty({ type: () => UserResponseDto })
  user: UserResponseDto;
}
