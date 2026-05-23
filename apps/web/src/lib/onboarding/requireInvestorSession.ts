import { auth } from '../../auth';

export async function requireInvestorSession() {
  const session = await auth();

  if (!session?.user?.accessToken) {
    return null;
  }

  const userId = session.user.id;
  const role = session.user.role;

  if (!userId) {
    return null;
  }

  if (role !== 'INVESTOR') {
    return { forbidden: true as const, session };
  }

  return { userId, email: session.user.email ?? '', session };
}
