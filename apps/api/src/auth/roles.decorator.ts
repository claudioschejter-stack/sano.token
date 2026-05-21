import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type SystemRole =
  | 'ADMIN'
  | 'ADVISOR_MANAGER'
  | 'ADVISOR'
  | 'INVESTOR'
  | 'TREASURY'
  | 'OPERATOR';

export const Roles = (...roles: SystemRole[]) => SetMetadata(ROLES_KEY, roles);
