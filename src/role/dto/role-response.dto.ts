import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class UserRoleResponseDto {
    @ApiProperty({ example: 1 })
    id: number;
  
    @ApiProperty({ example: 'Administrator' })
    name: string;
  
    @ApiProperty({ example: 'ADMIN' })
    code: string;
  
    @ApiProperty({ example: 'Administers GoHappyGo platform' })
    description: string;
  }

export class UserResponseDto {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 'John' })
    name: string;
}

export class CreateUserResponseDto {
    @ApiProperty({ example: 'User created successfully' })
    message: string;
    @ApiProperty({ example: UserResponseDto })
    user: UserResponseDto;
}