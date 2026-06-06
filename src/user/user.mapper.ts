import { Injectable } from '@nestjs/common';
import { CommonService } from 'src/common/service/common.service';
import { UserListItemResponseDto } from './dto/user-list-item-response.dto';
import { UserEntity } from './user.entity';

@Injectable()
export class UserMapper {
  constructor(private readonly commonService: CommonService) {}

  deriveIsStripeVerified(
    stripeAccountStatus: UserEntity['stripeAccountStatus'] | null | undefined,
  ): boolean {
    return stripeAccountStatus === 'active' || stripeAccountStatus === 'restricted';
  }

  toUserListItemDto(
    user: UserEntity,
    isAwaitingVerification: boolean,
  ): UserListItemResponseDto {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: this.commonService.userFullName(user),
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      isDeactivated: user.isDeactivated,
      role: {
        id: user.role.id,
        code: user.role.code,
      },
      isStripeVerified: this.deriveIsStripeVerified(user.stripeAccountStatus),
      isVerified: user.isVerified,
      isAwaitingVerification,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      rating: user.rating,
      numberOfReviews: user.numberOfReviews,
    };
  }
}
