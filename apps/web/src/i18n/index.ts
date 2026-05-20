import { de } from './locales/de';
import { en, type Messages } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { ru } from './locales/ru';
import { zh } from './locales/zh';

export type Locale = 'es' | 'en' | 'ru' | 'zh' | 'fr' | 'de';

export const defaultLocale: Locale = 'es';

export const locales: Locale[] = ['es', 'en', 'ru', 'zh', 'fr', 'de'];

export const localeOptions: Array<{
  value: Locale;
  flag: string;
  label: string;
}> = [
  { value: 'es', flag: '🇪🇸', label: 'Español' },
  { value: 'en', flag: '🇬🇧', label: 'English' },
  { value: 'ru', flag: '🇷🇺', label: 'Русский' },
  { value: 'zh', flag: '🇨🇳', label: '中文' },
  { value: 'fr', flag: '🇫🇷', label: 'Français' },
  { value: 'de', flag: '🇩🇪', label: 'Deutsch' }
];

export const intlLocaleByCode: Record<Locale, string> = {
  es: 'es-AR',
  en: 'en-US',
  ru: 'ru-RU',
  zh: 'zh-CN',
  fr: 'fr-FR',
  de: 'de-DE'
};

export const messagesByLocale: Record<Locale, Messages> = {
  en,
  es,
  ru,
  zh,
  fr,
  de
};

export function resolveLocale(input?: string | null): Locale {
  if (input && locales.includes(input as Locale)) {
    return input as Locale;
  }

  return defaultLocale;
}

export function formatMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}
