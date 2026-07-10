'use client';

import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { localeOptions, type Locale } from '../../i18n';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';

type LanguageDropdownProps = {
  /** light = landing header (white bg); dark = optional future use */
  variant?: 'light' | 'dark';
  className?: string;
};

export function LanguageDropdown({ variant = 'light', className = '' }: LanguageDropdownProps) {
  const { locale, setLocale } = useLocale();
  const t = useTranslation();

  const labelClass =
    variant === 'light' ? 'text-slate-600' : 'text-terminal-muted';
  const selectClass =
    variant === 'light'
      ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-blue-500'
      : 'border-terminal-border bg-terminal-card text-terminal-text focus:border-terminal-primary focus:ring-terminal-primary';

  return (
    // fix: 10 aria-label on label container and select for full a11y coverage
    <label
      aria-label={t.landing.languageSelectAria}
      className={`flex w-full flex-col gap-2 text-sm font-medium sm:flex-row sm:items-center lg:ml-[0.5cm] lg:w-auto ${labelClass} ${className}`.trim()}
    >
      <span className="whitespace-nowrap">{t.landing.languageLabel}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale, { manual: true })}
        className={`min-h-12 w-full cursor-pointer rounded-lg border px-3 py-3 text-base font-medium shadow-sm outline-none focus:ring-2 sm:min-h-0 sm:w-auto sm:py-2 sm:text-sm ${selectClass}`}
        aria-label={t.landing.languageSelectAria}
      >
        {localeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type LanguageMobilePanelProps = {
  menuOpen?: boolean;
  onLocaleSelected?: () => void;
};

export function LanguageMobilePanel({ menuOpen = false, onLocaleSelected }: LanguageMobilePanelProps) {
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const { locale, setLocale } = useLocale();
  const t = useTranslation();

  useEffect(() => {
    if (!menuOpen) {
      setLanguagesOpen(false);
    }
  }, [menuOpen]);

  const handleLocaleSelect = (nextLocale: Locale) => {
    setLocale(nextLocale, { manual: true });
    onLocaleSelected?.();
  };

  return (
    <div className="relative mt-1">
      {/* fix: 10 aria-label on mobile trigger button */}
      <button
        type="button"
        aria-label={t.landing.languageSelectAria}
        className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
        aria-expanded={languagesOpen}
        onClick={() => setLanguagesOpen(true)}
      >
        <span>{t.landing.languagesMenuLabel}</span>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-slate-500" />
      </button>

      {languagesOpen ? (
        <div className="absolute left-full top-0 z-10 ml-2 max-h-[min(70dvh,24rem)] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <ul role="list">
            {localeOptions.map((option) => {
              const isActive = locale === option.value;

              return (
                <li key={option.value}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition ${
                      isActive
                        ? 'bg-blue-50 font-semibold text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => handleLocaleSelect(option.value)}
                  >
                    <span aria-hidden>{option.flag}</span>
                    <span>{option.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
