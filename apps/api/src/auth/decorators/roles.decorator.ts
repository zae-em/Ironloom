import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '@ironloom/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);
