'use client';

import { useEffect, useState } from 'react';

/**
 * Fetches the user's real profile photo (e.g. copied from the Didit KYC portrait)
 * on mount. We deliberately don't rely on the NextAuth session/JWT here, since the
 * photo can be set well after the session was first issued (KYC approval webhook
 * runs server-side, out of band from the active client session).
 */
export function useProfilePhoto(): string | null {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { image?: string | null } | null) => {
        if (!cancelled && data?.image) {
          setImage(data.image);
        }
      })
      .catch(() => {
        // Best-effort only — fall back to initials avatar.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return image;
}
