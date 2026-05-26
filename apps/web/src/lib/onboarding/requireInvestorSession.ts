import { auth } from '../../auth';

export async function requireInvestorSession() {
  const session = await auth();

  if (!session?.user?.accessToken) {
    return null;
  }

  const userId = session.user.id;

  if (!userId) {
    return null;
  }

  return {
    userId,
    email: session.user.email ?? '',
    role: session.user.role,
    session
  };
}
