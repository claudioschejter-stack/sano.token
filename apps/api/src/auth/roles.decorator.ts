import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type SystemRole = 'ADMIN' | 'TREASURY' | 'OPERATOR' | 'INVESTOR';

export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);
