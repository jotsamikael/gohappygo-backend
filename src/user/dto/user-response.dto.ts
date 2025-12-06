import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { UserRoleResponseDto } from 'src/role/dto/role-response.dto';

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'john.doe@example.com' })
  @Expose()
  email: string;

  @ApiProperty({ example: 'John' }) 
  @Expose()
  firstName: string;

  @ApiProperty({ example: 'Doe' })  
  @Expose()
  lastName: string;

  @ApiProperty({ example: 'John D.' })
  @Expose()
  fullName: string;

  @ApiProperty({ example: '+1234567890' })  
  @Expose()
  phone: string;

  @ApiProperty({ example: 'john_doe' })
  @Expose()
  username: string;

  @ApiProperty({ example: 'https://example.com/profile.jpg' })
  @Expose()
  profilePictureUrl: string;

  @ApiProperty({ example: 'Frequent traveler who loves helping others', nullable: true })
  @Expose()
  bio?: string;

  @ApiProperty({ type: UserRoleResponseDto })
  role: UserRoleResponseDto;

  @ApiProperty({ example: false })
  isDeactivated: boolean;

  @ApiProperty({ example: false })
  isPhoneVerified: boolean;

  @ApiProperty({ example: false })  
  @Expose()
  isVerified: boolean;
  
  @ApiProperty({ example: false })
  isAwaitingVerification: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class CreateUserResponseDto {    
    @ApiProperty({ example: 'User created successfully' })
    message: string;
    @ApiProperty({ example: UserResponseDto })
    user: UserResponseDto;
}


export class PaginatedUserResponseDto{
  @ApiProperty({ type: [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}