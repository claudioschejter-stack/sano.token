/** Locale codes only — safe for Edge middleware (no message catalogs). */
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
  | 'mr';

export const defaultLocale: Locale = 'es';

export const locales: readonly Locale[] = [
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
  'mr'
];

const LOCALE_SET = new Set<string>(locales);

export function isLocaleCode(value: string): value is Locale {
  return LOCALE_SET.has(value);
}
