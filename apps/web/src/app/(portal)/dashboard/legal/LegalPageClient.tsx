'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, FileText, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../../../i18n/LocaleProvider';
import { MP_ACCENT, MP_ACCENT_SOFT } from '../../../../lib/pwa/mpTheme';

export function LegalPageClient() {
  const t = useTranslation();
  const router = useRouter();

  const links = [
    { href: '/terminos', label: t.legal.termsLink, icon: FileText },
    { href: '/privacidad', label: t.legal.privacyLink, icon: ShieldCheck }
  ];

  return (
    <div className="-mx-4 -mt-4 min-h-full bg-slate-50 pb-6 font-sans">
      <div className="flex items-center justify-between bg-white px-4 py-4 shadow-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500"
          aria-label={t.pwaHome.backToPanel}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-900">{t.nav.legal}</h1>
        <span className="w-9" />
      </div>

      <div className="space-y-3 px-4 pt-4">
        <p className="text-xs text-slate-500">{t.legal.bannerText}</p>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          {links.map(({ href, label, icon: Icon }, idx) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-4 p-4 transition-colors active:opacity-80 ${
                idx !== 0 ? 'border-t border-slate-100' : ''
              }`}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
              >
                <Icon size={20} />
              </div>
              <span className="flex-1 text-sm font-semibold text-slate-900">{label}</span>
              <ChevronRight size={18} className="text-slate-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
