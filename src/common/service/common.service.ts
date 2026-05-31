import { Injectable } from "@nestjs/common";

@Injectable()
export class CommonService {
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
}