import { Injectable } from '@nestjs/common';

/**
 * Visibility rules apply to discovery endpoints (lists, search, GET by id for clients).
 * Internal/reference lookups should use *ForReference / findOneById service methods instead.
 */
@Injectable()
export class VisibilityService {
  private readonly privilegedRoles = ['ADMIN', 'OPERATOR'];

  /**
   * Check if the given user can view deactivated records.
   * Admins and operators have full visibility.
   */
  canViewDeactivated(user: any): boolean {
    if (!user) {
      return false;
    }
    const roleCode =
      typeof user.role === 'string'
        ? user.role
        : user.role?.code ?? user.roleCode;
    if (!roleCode) {
      return false;
    }
    return this.privilegedRoles.includes(roleCode);
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

  /**
   * Restrict a TypeORM query builder to active records for non-privileged users.
   */
  applyIsDeactivatedToQueryBuilder(
    user: any,
    queryBuilder: { andWhere: (clause: string, params?: Record<string, unknown>) => unknown },
    alias: string,
  ): void {
    if (!this.canViewDeactivated(user)) {
      queryBuilder.andWhere(`${alias}.isDeactivated = :isDeactivated`, { isDeactivated: false });
    }
  }
}