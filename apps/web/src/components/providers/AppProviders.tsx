'use client';

import type { ReactNode } from 'react';
import { LocaleHtmlSync } from '../i18n/LocaleHtmlSync';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { AuthTokenSync } from '../auth/AuthTokenSync';
import { AuthSessionProvider } from './AuthSessionProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthSessionProvider>
      <LocaleProvider>
        <LocaleHtmlSync />
        <AuthTokenSync />
        {children}
      </LocaleProvider>
    </AuthSessionProvider>
  );
}
