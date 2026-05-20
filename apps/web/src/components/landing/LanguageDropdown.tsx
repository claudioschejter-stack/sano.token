'use client';

import { localeOptions, type Locale } from '../../i18n';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';

type LanguageDropdownProps = {
  /** light = landing header (white bg); dark = optional future use */
  variant?: 'light' | 'dark';
};

export function LanguageDropdown({ variant = 'light' }: LanguageDropdownProps) {
  const { locale, setLocale } = useLocale();
  const t = useTranslation();

  const labelClass =
    variant === 'light' ? 'text-slate-600' : 'text-terminal-muted';
  const selectClass =
    variant === 'light'
      ? 'border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-blue-500'
      : 'border-terminal-border bg-terminal-card text-terminal-text focus:border-terminal-primary focus:ring-terminal-primary';

  return (
    <label className={`flex items-center gap-2 text-sm font-medium ${labelClass}`}>
      <span className="whitespace-nowrap">{t.landing.languageLabel}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium shadow-sm outline-none focus:ring-2 ${selectClass}`}
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
