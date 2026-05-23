import { auth } from '../../auth';
import { getAdvisorContextForUser, type AdvisorContext } from '../advisor/advisorContext';
import type { SystemRole } from '../auth/roles';

export async function requireAdminSession() {
  const session = await auth();

  if (session?.user?.role !== 'ADMIN') {
    return null;
  }

  return session;
}

export async function requireAdvisorSession() {
  const session = await auth();
  const role = session?.user?.role;
  const userId = session?.user?.id;

  if (!userId || (role !== 'ADVISOR' && role !== 'ADVISOR_MANAGER')) {
    return null;
  }

  const advisor = await getAdvisorContextForUser(userId, role);
  if (!advisor) {
    return null;
  }

  return { session, advisor };
}

export function hasRole(role: SystemRole | undefined, allowed: SystemRole[]): boolean {
  return Boolean(role && allowed.includes(role));
}
