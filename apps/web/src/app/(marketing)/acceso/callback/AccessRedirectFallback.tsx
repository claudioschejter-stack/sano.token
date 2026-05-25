'use client';

import { useTranslation } from '../../../../i18n/LocaleProvider';

export function AccessRedirectFallback() {
  const access = useTranslation().access;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
      <p className="text-sm font-medium">{access.redirecting}</p>
    </div>
  );
}
