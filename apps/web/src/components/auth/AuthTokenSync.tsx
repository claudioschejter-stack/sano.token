'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

const TOKEN_STORAGE_KEY = 'sanova.jwt';

export function AuthTokenSync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.accessToken) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, session.user.accessToken);
      return;
    }

    if (status === 'unauthenticated') {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, [session?.user?.accessToken, status]);

  return null;
}
