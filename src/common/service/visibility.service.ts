import { Injectable } from '@nestjs/common';

@Injectable()
export class VisibilityService {
  private readonly privilegedRoles = ['ADMIN', 'OPERATOR'];

  /**
   * Check if the given user can view deactivated records.
   * Admins and operators have full visibility.
   */
  canViewDeactivated(user: any): boolean {
    if (!user || !user.role) {
      return false;
    }
    return this.privilegedRoles.includes(user.role.code);
  }

  /**
   * Apply the isDeactivated filter based on user role.
   *
   * - Admin/operator: no filter added (sees all records)
   * - Normal user / anonymous: adds `isDeactivated: false` (sees only active records)
   *
   * @param user - The authenticated user (or null/undefined for anonymous)
   * @param where - Existing WHERE conditions to merge with
   * @returns The WHERE object with the appropriate filter applied
   */
  applyIsDeactivatedFilter(user: any, where: any = {}): any {
    if (this.canViewDeactivated(user)) {
      return where;
    }

    return {
      ...where,
      isDeactivated: false,
    };
  }
}