'use client';

import type { ReactNode } from 'react';
import { SessionLocaleSync } from '../i18n/SessionLocaleSync';
import { LocaleHtmlSync } from '../i18n/LocaleHtmlSync';
import { LocaleProvider } from '../../i18n/LocaleProvider';
import { AuthTokenSync } from '../auth/AuthTokenSync';
import { SessionAutoLogout } from '../auth/SessionAutoLogout';
import { ClientPageHardening } from '../security/ClientPageHardening';
import { ThemeProvider } from './ThemeProvider';
import { SessionPreferencesSync } from '../preferences/SessionPreferencesSync';
import { AuthSessionProvider } from './AuthSessionProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthSessionProvider>
      <ThemeProvider>
        <LocaleProvider>
          <LocaleHtmlSync />
          <SessionLocaleSync />
          <SessionPreferencesSync />
          <AuthTokenSync />
          <SessionAutoLogout />
          <ClientPageHardening />
          {children}
        </LocaleProvider>
      </ThemeProvider>
    </AuthSessionProvider>
  );
}
