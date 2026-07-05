'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, HandCoins } from 'lucide-react';
import { useTranslation } from '../../../../i18n/LocaleProvider';
import { MP_ACCENT, MP_ACCENT_SOFT } from '../../../../lib/pwa/mpTheme';

export function LoansPageClient() {
  const t = useTranslation();
  const router = useRouter();

  return (
    <div className="-mx-4 -mt-4 flex min-h-full flex-col bg-slate-50 font-sans">
      <div className="flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500"
          aria-label={t.pwaHome.backToPanel}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-900">{t.nav.loans}</h1>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
        >
          <HandCoins size={28} />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">{t.pwaHome.comingSoonTitle}</h2>
        <p className="mt-2 max-w-xs text-sm text-slate-500">{t.pwaHome.comingSoonBody}</p>
      </div>
    </div>
  );
}
