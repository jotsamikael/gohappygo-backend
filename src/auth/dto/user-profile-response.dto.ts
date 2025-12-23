import { ApiProperty } from "@nestjs/swagger";
import { CurrencyResponseDto } from "src/currency/dto/currency-response.dto";
import { UserRoleResponseDto } from "src/role/dto/role-response.dto";
import { Expose, Transform, Type } from "class-transformer";

export class ProfileStatsResponseDto {
    @ApiProperty({ example: 1 })
    @Expose()   
    requestsCompletedCount: number; // After travel is completed and the user has received the payment
    
    @ApiProperty({ example: 1 })
    @Expose()
    requestsNegotiatingCount: number; // After travel is published and the user is waiting for a traveler to accept the request
    
    @ApiProperty({ example: 1 })
    @Expose()
    requestsCancelledCount: number; // requests that have been cancelled by the user
   
    @ApiProperty({ example: 1 })
    @Expose()
    requestsAcceptedCount: number; // requests that have been accepted by the user who created the request
   
    @ApiProperty({ example: 1 })
    @Expose()
    requestsRejectedCount: number; // requests that have been rejected by the user

    /*@ApiProperty({ example: 1 })
    @Expose()
    unReadMessagesCount: number; // messages that have not been read by the user*/

    @ApiProperty({ example: 1 })
    @Expose()
    reviewsReceivedCount: number;
    
    @ApiProperty({ example: 1 })
    @Expose()
    reviewsGivenCount: number;

    @ApiProperty({ example: 1 })
    @Expose()
    demandsCount: number;

    @ApiProperty({ example: 1 })
    @Expose()
    travelsCount: number;


    @ApiProperty({ example: 1 })
    @Expose()
    bookMarkTravelCount: number;

    @ApiProperty({ example: 1 })
    @Expose()
    bookMarkDemandCount: number;

    @ApiProperty({ example: 1 })
    @Expose()
    transactionsCompletedCount: number; // After travel is completed and the user has received the payment
}

export class UserProfileResponseDto {
    @ApiProperty({ example: 1 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'john.doe@example.com' })
    @Expose()
    email: string;
    
    @ApiProperty({ example: 'John' })
    @Expose()
    firstName: string;
    
    @Expose()
    lastName: string;
    @Expose()
    phone: string;

    @ApiProperty({ example: 'https://example.com/profile.jpg' })
    @Expose()
    profilePictureUrl: string;

    @ApiProperty({ example: 'Frequent traveler who loves helping others' })
    @Expose()
    bio: string;

    @ApiProperty({ type: UserRoleResponseDto })
    @Expose()
    role: UserRoleResponseDto;

    @ApiProperty({ example: false })
    @Expose()
    isPhoneVerified: boolean;

    @ApiProperty({ example: false })
    @Expose()
    isVerified: boolean;

    @ApiProperty({ example: false })
    @Expose()
    isAwaitingVerification: boolean;

    @ApiProperty({ type: CurrencyResponseDto, nullable: true })
    @Expose()
    recentCurrency: CurrencyResponseDto | null;

    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
    @Expose()
    createdAt: Date;

    @ApiProperty({ type: ProfileStatsResponseDto })
    @Expose()
    @Type(() => ProfileStatsResponseDto)
    profileStats: ProfileStatsResponseDto;

    @ApiProperty({ example: 'acct_1234567890', nullable: true, description: 'Stripe Connect account ID' })
    @Expose()
    stripeAccountId: string | null;

    @ApiProperty({ 
        example: 'pending', 
        enum: ['uninitiated', 'pending', 'active', 'restricted'],
        description: 'Stripe Connect account status' 
    })
    @Expose()
    stripeAccountStatus: 'uninitiated' | 'pending' | 'active' | 'restricted';

    @ApiProperty({ example: 'FR', nullable: true, description: 'ISO 3166-1 alpha-2 country code for Stripe Connect account' })
    @Expose()
    stripeCountryCode: string | null;
}

