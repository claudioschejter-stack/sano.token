export { requireAdminSession } from '../staff/requireStaff';

import type { SystemRole } from '../auth/roles';

export function isAdminRole(role?: SystemRole | null): role is 'ADMIN' {
  return role === 'ADMIN';
}
