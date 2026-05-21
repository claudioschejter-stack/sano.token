'use client';

import type { ReactNode } from 'react';
import { LocaleHtmlSync } from '../i18n/LocaleHtmlSync';
import { LocaleProvider } from '../../i18n/LocaleProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <LocaleHtmlSync />
      {children}
    </LocaleProvider>
  );
}
