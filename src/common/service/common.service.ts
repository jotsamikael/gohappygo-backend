import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccountStatus, DELETED_USER_DISPLAY_NAME } from "src/account-deletion/account-deletion.types";
import { UserEntity } from "src/user/user.entity";

export interface PublicUserDisplay {
    id: number;
    publicId?: string;
    fullName: string;
    profilePictureUrl: string | null;
    bio?: string | null;
    isVerified: boolean;
    isDeactivated?: boolean;
    rating?: string | number | null;
    numberOfReviews?: number;
    stripeAccountStatus?: string;
    stripeCountryCode?: string | null;
    username?: string | null;
    phone?: string | null;
    isPhoneVerified?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

@Injectable()
export class CommonService {
    constructor(@Optional() private readonly configService?: ConfigService) {}

    /** Use configured placeholder when an airline logo is missing in API responses. */
    resolveAirlineLogoUrl(logoUrl?: string | null): string {
        const trimmed = (logoUrl ?? '').trim();
        if (trimmed) {
            return trimmed;
        }

        return (
            this.configService?.get<string>('placeholderImageUrl')?.trim() ||
            process.env.PLACEHOLDER_IMAGE_URL?.trim() ||
            ''
        );
    }

     /**
     * Formats a user's full name as "Firstname L."
     * @param firstName - User's first name
     * @param lastName - User's last name
     * @returns Formatted full name (e.g., "Patrick O.")
     */
     formatFullName(firstName: string, lastName: string): string {
        if (!firstName || !lastName) {
            return firstName || '';
        }
        
        const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        const lastNameInitial = lastName.charAt(0).toUpperCase();
        
        return `${capitalizedFirstName} ${lastNameInitial}.`;
    }

    /**
     * Prefer persisted `username` as display name; fallback to formatted names.
     * This keeps API responses consistent and avoids relying on first/last name being present
     * on "public user" objects (e.g. JWT validate payload shaping).
     */
    userFullName(
        user:
            | { username?: string | null; firstName?: string | null; lastName?: string | null; fullName?: string | null }
            | null
            | undefined,
    ): string {
        const explicitFullName = (user?.fullName ?? '').trim();
        if (explicitFullName) {
            return explicitFullName;
        }
        const username = (user?.username ?? '').trim();
        if (username) {
            return username;
        }
        const firstName = (user?.firstName ?? '').trim();
        const lastName = (user?.lastName ?? '').trim();
        return this.formatFullName(firstName, lastName) || firstName || '';
    }

    /** Greeting for emails/events; safe for JWT public user objects without firstName. */
    userGreetingName(
        user:
            | { username?: string | null; firstName?: string | null; lastName?: string | null; fullName?: string | null }
            | null
            | undefined,
        fallback = 'there',
    ): string {
        return this.userFullName(user) || fallback;
    }

    isAnonymizedUser(
        user:
            | (Pick<UserEntity, 'accountStatus' | 'deletedAt'> & Partial<UserEntity>)
            | null
            | undefined,
    ): boolean {
        if (!user) {
            return false;
        }
        return user.accountStatus === AccountStatus.ANONYMIZED || !!user.deletedAt;
    }

    /** Stable public profile for anonymized/deleted owners — never exposes email or phone. */
    publicUserOrDeletedPlaceholder(
        user: UserEntity | null | undefined,
        userId?: number,
    ): PublicUserDisplay | null {
        if (!user && !userId) {
            return null;
        }

        if (!user && userId) {
            return {
                id: userId,
                fullName: DELETED_USER_DISPLAY_NAME,
                profilePictureUrl: null,
                isVerified: false,
            };
        }

        if (this.isAnonymizedUser(user)) {
            return {
                id: user!.id,
                publicId: user!.publicId,
                fullName: DELETED_USER_DISPLAY_NAME,
                profilePictureUrl: null,
                bio: null,
                isVerified: false,
                isDeactivated: user!.isDeactivated,
                rating: user!.rating ? user!.rating.toString() : null,
                numberOfReviews: user!.numberOfReviews ?? 0,
                stripeAccountStatus: user!.stripeAccountStatus ?? 'uninitiated',
                stripeCountryCode: user!.stripeCountryCode ?? null,
                username: null,
                createdAt: user!.createdAt,
                updatedAt: user!.updatedAt,
            };
        }

        return {
            id: user!.id,
            publicId: user!.publicId,
            fullName: this.userFullName(user!),
            profilePictureUrl: user!.profilePictureUrl || null,
            bio: user!.bio || null,
            isVerified: user!.isVerified,
            isDeactivated: user!.isDeactivated,
            rating: user!.rating ? user!.rating.toString() : null,
            numberOfReviews: user!.numberOfReviews ?? 0,
            stripeAccountStatus: user!.stripeAccountStatus ?? 'uninitiated',
            stripeCountryCode: user!.stripeCountryCode ?? null,
            username: user!.username || null,
            createdAt: user!.createdAt,
            updatedAt: user!.updatedAt,
        };
    }
}