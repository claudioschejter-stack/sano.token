'use client';

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
    variant === 'light'
      ? 'text-slate-600'
      : 'text-[10px] font-mono uppercase tracking-widest text-slate-400';
  const selectClass =
    variant === 'light'
      ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-blue-500'
      : 'border-white/10 bg-white/5 text-white font-light transition-all duration-300 focus:border-blue-500/50 focus:bg-white/10 focus:ring-0';

  return (
    <label
      className={`flex w-full flex-col gap-2 text-sm font-medium sm:flex-row sm:items-center lg:ml-[0.5cm] lg:w-auto ${labelClass} ${className}`.trim()}
    >
      <span className="whitespace-nowrap">{t.landing.languageLabel}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className={`min-h-12 w-full cursor-pointer rounded-lg border px-3 py-3 text-base font-medium shadow-sm outline-none focus:ring-2 sm:min-h-0 sm:w-auto sm:py-2 sm:text-sm ${selectClass}`}
        aria-label={t.landing.languageLabel}
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
