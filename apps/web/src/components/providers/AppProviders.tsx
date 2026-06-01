'use client';

import type { ReactNode } from 'react';
import { LocaleHtmlSync } from '../i18n/LocaleHtmlSync';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { AuthTokenSync } from '../auth/AuthTokenSync';
import { SessionAutoLogout } from '../auth/SessionAutoLogout';
import { AuthSessionProvider } from './AuthSessionProvider';
import { Web3Providers } from './providers';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthSessionProvider>
      <LocaleProvider>
        <Web3Providers>
          <LocaleHtmlSync />
          <AuthTokenSync />
          <SessionAutoLogout />
          {children}
        </Web3Providers>
      </LocaleProvider>
    </AuthSessionProvider>
  );
}
