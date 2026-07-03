'use client';

import { ChevronDown, Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { localeOptions, type Locale } from '../../i18n';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';
import { pinMobileLocale } from '../../lib/i18n/mobileLocalePreference';
import { PORTAL_MOBILE_HEADER_HEIGHT } from '../../lib/mobile/deviceConfig';

type SidebarLanguageButtonProps = {
  onLocaleSelected?: () => void;
};

export function SidebarLanguageButton({ onLocaleSelected }: SidebarLanguageButtonProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { locale, setLocale } = useLocale();
  const t = useTranslation();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleSelect = (nextLocale: Locale) => {
    pinMobileLocale(nextLocale);
    setLocale(nextLocale, { manual: true });
    setOpen(false);
    onLocaleSelected?.();
    router.refresh();
  };

  const popup =
    open && mounted
      ? createPortal(
          <>
            <button
              type="button"
              aria-label={t.landing.nav.closeMenu}
              className="fixed inset-x-0 bottom-0 z-[55] bg-black/50 md:hidden"
              style={{ top: PORTAL_MOBILE_HEADER_HEIGHT }}
              onClick={() => setOpen(false)}
            />
            <aside
              className="fixed bottom-0 right-0 z-[56] flex w-72 max-w-[85vw] flex-col border-l border-terminal-border bg-terminal-card text-terminal-text shadow-2xl md:hidden"
              style={{ top: PORTAL_MOBILE_HEADER_HEIGHT }}
              aria-label={t.landing.languageLabel}
            >
              <div className="shrink-0 border-b border-terminal-border px-4 py-3">
                <p className="text-sm font-semibold text-terminal-text">{t.landing.languageLabel}</p>
              </div>
              <ul role="list" className="min-h-0 flex-1 overflow-y-auto py-1">
                {localeOptions.map((option) => {
                  const isActive = locale === option.value;

                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition ${
                          isActive
                            ? 'bg-terminal-primary/10 font-semibold text-terminal-primary'
                            : 'text-terminal-muted hover:bg-terminal-bg hover:text-terminal-text'
                        }`}
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => handleSelect(option.value)}
                      >
                        <span aria-hidden>{option.flag}</span>
                        <span>{option.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
          </>,
          document.body
        )
      : null;

  return (
    <div className="w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-terminal-muted transition-colors hover:bg-terminal-bg hover:text-terminal-text"
      >
        <Languages size={20} aria-hidden />
        <span className="flex-1 text-left font-medium">{t.landing.languageLabel}</span>
        <ChevronDown
          size={18}
          aria-hidden
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {popup}
    </div>
  );
}
