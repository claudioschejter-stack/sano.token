'use client';

import { useEffect, useState } from 'react';
import { PasskeyRegisterInline } from './PasskeyRegisterInline';

type PasskeyRegisterPromptProps = {
  className?: string;
};

export function PasskeyRegisterPrompt({ className = '' }: PasskeyRegisterPromptProps) {
  const [hasPasskeys, setHasPasskeys] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/passkey/status')
      .then((res) => res.json() as Promise<{ hasPasskeys: boolean }>)
      .then(({ hasPasskeys: hp }) => setHasPasskeys(hp))
      .catch(() => setHasPasskeys(false));
  }, []);

  if (hasPasskeys === null || hasPasskeys) {
    return null;
  }

  return <PasskeyRegisterInline className={className} />;
}
