import { ar } from './locales/ar';
import { bn } from './locales/bn';
import { de } from './locales/de';
import { en, type Messages } from './locales/en';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { he } from './locales/he';
import { hi } from './locales/hi';
import { id } from './locales/id';
import { ja } from './locales/ja';
import { mr } from './locales/mr';
import { pt } from './locales/pt';
import { ru } from './locales/ru';
import { sw } from './locales/sw';
import { ur } from './locales/ur';
import { zh } from './locales/zh';
import { mergeLocale } from './locales/mergeLocale';

export type Locale =
  | 'en'
  | 'zh'
  | 'hi'
  | 'es'
  | 'fr'
  | 'ar'
  | 'bn'
  | 'pt'
  | 'ru'
  | 'ur'
  | 'id'
  | 'de'
  | 'ja'
  | 'sw'
  | 'mr'
  | 'he';

export const defaultLocale: Locale = 'es';

export const locales: Locale[] = [
  'en',
  'zh',
  'hi',
  'es',
  'fr',
  'ar',
  'bn',
  'pt',
  'ru',
  'ur',
  'id',
  'de',
  'ja',
  'sw',
  'mr',
  'he'
];

const localeOptionsSource: Array<{
  value: Locale;
  flag: string;
  label: string;
}> = [
  { value: 'en', flag: '🇬🇧', label: 'English' },
  { value: 'zh', flag: '🇨🇳', label: '中文' },
  { value: 'hi', flag: '🇮🇳', label: 'हिन्दी' },
  { value: 'es', flag: '🇪🇸', label: 'Español' },
  { value: 'fr', flag: '🇫🇷', label: 'Français' },
  { value: 'ar', flag: '🇸🇦', label: 'العربية' },
  { value: 'bn', flag: '🇧🇩', label: 'বাংলা' },
  { value: 'pt', flag: '🇧🇷', label: 'Português' },
  { value: 'ru', flag: '🇷🇺', label: 'Русский' },
  { value: 'ur', flag: '🇵🇰', label: 'اردو' },
  { value: 'id', flag: '🇮🇩', label: 'Bahasa Indonesia' },
  { value: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { value: 'ja', flag: '🇯🇵', label: '日本語' },
  { value: 'sw', flag: '🇰🇪', label: 'Kiswahili' },
  { value: 'mr', flag: '🇮🇳', label: 'मराठी' },
  { value: 'he', flag: '🇮🇱', label: 'עברית' }
];

/** Language picker options sorted A→Z by display label. */
export const localeOptions = [...localeOptionsSource].sort((a, b) =>
  a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true })
);

export const intlLocaleByCode: Record<Locale, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  hi: 'hi-IN',
  es: 'es-AR',
  fr: 'fr-FR',
  ar: 'ar-SA',
  bn: 'bn-BD',
  pt: 'pt-BR',
  ru: 'ru-RU',
  ur: 'ur-PK',
  id: 'id-ID',
  de: 'de-DE',
  ja: 'ja-JP',
  sw: 'sw-KE',
  mr: 'mr-IN',
  he: 'he-IL'
};

/** Locales that use right-to-left layout. */
export const rtlLocales: Locale[] = ['ar', 'ur', 'he'];

export const messagesByLocale: Record<Locale, Messages> = {
  en,
  zh: mergeLocale(zh),
  hi: mergeLocale(hi),
  es: mergeLocale(es),
  fr: mergeLocale(fr),
  ar: mergeLocale(ar),
  bn: mergeLocale(bn),
  pt: mergeLocale(pt),
  ru: mergeLocale(ru),
  ur: mergeLocale(ur),
  id: mergeLocale(id),
  de: mergeLocale(de),
  ja: mergeLocale(ja),
  sw: mergeLocale(sw),
  mr: mergeLocale(mr),
  he: mergeLocale(he)
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
