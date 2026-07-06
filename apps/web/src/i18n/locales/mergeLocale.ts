import type { Messages } from './en';
import { en } from './en';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep-merge a locale patch onto the English defaults (full Messages shape).
 *
 * This must recurse into nested objects (e.g. `access.register.errors`), not
 * just the top level. A shallow one-level merge silently drops any key added
 * to `en`'s nested objects that a given locale file doesn't also define,
 * because the locale's own nested object (e.g. `access.register`) fully
 * replaces English's instead of filling in the gaps. That previously caused
 * newly-added strings (e.g. register.forgotPasswordLink) to render blank in
 * every locale except the two that were updated directly.
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

export function mergeLocale(patch: Record<string, unknown>): Messages {
  return deepMerge(en, patch) as Messages;
}
