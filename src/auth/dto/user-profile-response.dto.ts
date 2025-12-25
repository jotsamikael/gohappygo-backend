import { ApiProperty } from "@nestjs/swagger";
import { CurrencyResponseDto } from "src/currency/dto/currency-response.dto";
import { Expose, Type } from "class-transformer";

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
    @ApiProperty({ example: 29 })
    @Expose()
    id: number;

    @ApiProperty({ example: 'jotsamikael0@gmail.com' })
    @Expose()
    email: string;
    
    @ApiProperty({ example: 'James D.' })
    @Expose()
    fullName: string;

    @ApiProperty({ example: 'https://res.cloudinary.com/dgdy4huuc/image/upload/v1765651873/gohappygo/ecuacdwgrjdvewflyczo.jpg', nullable: true })
    @Expose()
    profilePictureUrl: string | null;

    @ApiProperty({ example: 'I am a traveler who like exotic places', nullable: true })
    @Expose()
    bio: string | null;

    @ApiProperty({ example: false })
    @Expose()
    isPhoneVerified: boolean;

    @ApiProperty({ example: true })
    @Expose()
    isVerified: boolean;

    @ApiProperty({ example: false })
    @Expose()
    isAwaitingVerification: boolean;

    @ApiProperty({ type: CurrencyResponseDto, nullable: true })
    @Expose()
    @Type(() => CurrencyResponseDto)
    recentCurrency: CurrencyResponseDto | null;

    @ApiProperty({ example: '2025-09-13T19:44:29.010Z' })
    @Expose()
    createdAt: Date;

    @ApiProperty({ type: ProfileStatsResponseDto })
    @Expose()
    @Type(() => ProfileStatsResponseDto)
    profileStats: ProfileStatsResponseDto;

    @ApiProperty({ example: null, nullable: true })
    @Expose()
    stripeAccountId: string | null;

    @ApiProperty({ 
        example: 'uninitiated', 
        enum: ['uninitiated', 'pending', 'active', 'restricted']
    })
    @Expose()
    stripeAccountStatus: 'uninitiated' | 'pending' | 'active' | 'restricted';

    @ApiProperty({ example: null, nullable: true })
    @Expose()
    stripeCountryCode: string | null;
}

