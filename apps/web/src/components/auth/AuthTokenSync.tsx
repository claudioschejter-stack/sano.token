'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { JWT_STORAGE_KEY } from '../../lib/auth/sessionAutoLogout';

export function AuthTokenSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.accessToken) {
      window.localStorage.setItem(JWT_STORAGE_KEY, session.user.accessToken);
      return;
    }

    if (status === 'unauthenticated') {
      window.localStorage.removeItem(JWT_STORAGE_KEY);
    }
  }, [session?.user?.accessToken, status]);

  return null;
}
