import type { Messages } from './en';
import { en } from './en';

/** Shallow-merge locale patches onto English defaults (full Messages shape). */
export function mergeLocale(patch: Record<string, unknown>): Messages {
  const result: Record<string, unknown> = { ...en };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }

    const base = result[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base &&
      typeof base === 'object' &&
      !Array.isArray(base)
    ) {
      result[key] = { ...base, ...value };
      continue;
    }

    result[key] = value;
  }

  return result as Messages;
}
