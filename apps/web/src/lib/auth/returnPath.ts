const BLOCKED_PREFIXES = ['/acceso', '/kyc'];

/** Resolves nested ?returnTo= chains and blocks onboarding loops. */
export function normalizeReturnPath(value: string | null | undefined, fallback: string): string {
  if (!value?.trim()) {
    return fallback;
  }

  let current = value.trim();

  for (let depth = 0; depth < 10; depth++) {
    if (!current.startsWith('/') || current.startsWith('//')) {
      return fallback;
    }

    const queryIndex = current.indexOf('?');
    const pathname = queryIndex === -1 ? current : current.slice(0, queryIndex);
    const search = queryIndex === -1 ? '' : current.slice(queryIndex + 1);

    const isBlocked = BLOCKED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

    if (!isBlocked) {
      return current;
    }

    if (!search) {
      return fallback;
    }

    const inner = new URLSearchParams(search).get('returnTo');
    if (!inner) {
      return fallback;
    }

    try {
      current = decodeURIComponent(inner);
    } catch {
      return fallback;
    }
  }

  return fallback;
}
