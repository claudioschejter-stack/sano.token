'use client';

import { localeOptions } from '../../i18n';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale();
  const t = useTranslation();

  return (
    <div
      className={compact ? 'flex flex-wrap gap-1.5' : 'flex flex-col gap-2'}
      role="group"
      aria-label={t.nav.language}
    >
      {!compact ? (
        <p className="text-xs font-medium uppercase tracking-wider text-terminal-muted">{t.nav.language}</p>
      ) : null}
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-terminal-border bg-terminal-bg p-1">
        {localeOptions.map((option) => {
          const active = locale === option.value;

          return (
            <button
              key={option.value}
              type="button"
              title={option.label}
              aria-label={option.label}
              aria-pressed={active}
              onClick={() => setLocale(option.value)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-terminal-primary text-white shadow-sm'
                  : 'text-terminal-muted hover:bg-terminal-card hover:text-terminal-text'
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {option.flag}
              </span>
              {!compact ? (
                <span className="text-xs font-semibold">{option.value.toUpperCase()}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
