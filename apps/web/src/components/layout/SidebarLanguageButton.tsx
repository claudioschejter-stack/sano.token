'use client';

import { ChevronDown, Languages } from 'lucide-react';
import { useState } from 'react';
import { localeOptions, type Locale } from '../../i18n';
import { useLocale, useTranslation } from '../../i18n/LocaleProvider';

type SidebarLanguageButtonProps = {
  onLocaleSelected?: () => void;
};

export function SidebarLanguageButton({ onLocaleSelected }: SidebarLanguageButtonProps) {
  const [open, setOpen] = useState(false);
  const { locale, setLocale } = useLocale();
  const t = useTranslation();

  const handleSelect = (nextLocale: Locale) => {
    setLocale(nextLocale);
    setOpen(false);
    onLocaleSelected?.();
  };

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

      {open ? (
        <ul
          role="list"
          className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-terminal-border bg-terminal-bg py-1"
        >
          {localeOptions.map((option) => {
            const isActive = locale === option.value;

            return (
              <li key={option.value}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition ${
                    isActive
                      ? 'bg-terminal-primary/10 font-semibold text-terminal-primary'
                      : 'text-terminal-muted hover:bg-terminal-card hover:text-terminal-text'
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
      ) : null}
    </div>
  );
}
