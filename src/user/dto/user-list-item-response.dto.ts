import { ApiProperty } from '@nestjs/swagger';

export class UserListRoleResponseDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'USER' })
  code: string;
}

export class UserListItemResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'us_01ARZ3NDEKTSV4RRFFQ69G5FAV' })
  publicId: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: '+1234567890' })
  phone: string;

  @ApiProperty({ example: 'John D.' })
  fullName: string;

  @ApiProperty({ example: 'https://example.com/profile.jpg' })
  profilePictureUrl: string;

  @ApiProperty({ example: 'Frequent traveler who loves helping others', nullable: true })
  bio?: string;

  @ApiProperty({ example: false })
  isDeactivated: boolean;

  @ApiProperty({ type: UserListRoleResponseDto })
  role: UserListRoleResponseDto;

  @ApiProperty({
    example: false,
    description: 'True when stripeAccountStatus is active or restricted; false when uninitiated or pending',
  })
  isStripeVerified: boolean;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiProperty({ example: false })
  isAwaitingVerification: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: 4.75, nullable: true })
  rating: number | null;

  @ApiProperty({ example: 15 })
  numberOfReviews: number;
}
