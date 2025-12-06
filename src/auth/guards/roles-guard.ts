import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/role.decorators';

@Injectable()
export class RolesGuard implements CanActivate {

  //Reflector is a utility that allow you to access metadata
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no role restriction
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // If user has a single role with a "code" field
    const userRoleCode = user.role?.code;

    // If user has multiple roles (optional future-proofing)
    const userRoleCodes = Array.isArray(user.roles)
      ? user.roles.map((r) => r.code)
      : [userRoleCode];

    const hasRequiredRole = requiredRoles.some((required) =>
      userRoleCodes.includes(required),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException('Insufficient permission');
    }

    return true;
  }
}
