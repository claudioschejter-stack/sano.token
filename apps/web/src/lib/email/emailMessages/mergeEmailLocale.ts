import type { EmailMessages, EmailMessagesPatch } from './types';
import { en } from './en';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep-merges a locale patch onto the English defaults, mirroring
 * `apps/web/src/i18n/locales/mergeLocale.ts`. Any key missing from a given
 * locale's patch (e.g. a newly added email type not yet translated for every
 * language) falls back to English instead of rendering blank.
 */
function deepMerge(base: unknown, patch: unknown): unknown {
  if (patch === undefined) {
    return base;
  }

  if (isPlainObject(base) && isPlainObject(patch)) {
    const result: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      result[key] = deepMerge(base[key], value);
    }
    return result;
  }

  return patch;
}

export function mergeEmailLocale(patch: EmailMessagesPatch): EmailMessages {
  return deepMerge(en, patch) as EmailMessages;
}
