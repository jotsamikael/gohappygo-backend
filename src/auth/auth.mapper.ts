import { Injectable } from "@nestjs/common";
import { UserEntity } from "src/user/user.entity";
import { UserResponseDto } from "./dto/auth-response.dto";
import { UserProfileResponseDto, ProfileStatsResponseDto } from "./dto/user-profile-response.dto";
import { plainToInstance } from "class-transformer";

@Injectable()
export class AuthMapper {

  /**
   * Map user profile data to UserProfileResponseDto
   * Handles both USER role (with stats) and ADMIN/OPERATOR roles (without stats)
   */
  toUserProfileResponseWithStats(profileData: any): UserProfileResponseDto {
    return plainToInstance(UserProfileResponseDto, profileData, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true
    });
  }
}