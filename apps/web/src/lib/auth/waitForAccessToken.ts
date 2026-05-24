'use client';

import { getSession } from 'next-auth/react';

/** Wait until NextAuth session includes the API access token (post sign-in race). */
export async function waitForAccessToken(maxAttempts = 25, delayMs = 120): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const session = await getSession();
    if (session?.user?.accessToken) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return false;
}
