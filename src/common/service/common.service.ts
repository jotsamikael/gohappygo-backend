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
}