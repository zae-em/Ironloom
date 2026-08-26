import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUserContext, OrgRole } from '@ironloom/shared';

@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user: AuthUserContext = request.user;
    const targetOrgId =
      request.headers['x-org-id'] ||
      request.body?.orgId ||
      request.params?.orgId ||
      request.query?.orgId ||
      user?.orgId;

    if (!user) {
      throw new ForbiddenException('User context is not available');
    }

    if (!targetOrgId) {
      throw new ForbiddenException('Target Organization ID is required');
    }

    const membership = user.orgMemberships?.find((m) => m.orgId === targetOrgId);

    if (!membership) {
      throw new ForbiddenException(
        `Access denied: User does not belong to organization ${targetOrgId}`,
      );
    }

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(membership.role)) {
        throw new ForbiddenException(
          `Insufficient permissions: Role '${membership.role}' does not meet requirement [${requiredRoles.join(', ')}]`,
        );
      }
    }

    // Set confirmed orgId and active role on request
    request.orgId = targetOrgId;
    request.userRole = membership.role;

    return true;
  }
}
