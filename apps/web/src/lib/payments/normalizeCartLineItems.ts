import type { CartLineInput } from './cartCheckoutService';

/**
 * Normalize checkout cart lines from untrusted JSON / UI props.
 * Drops invalid rows so the pay endpoint never silently treats junk as "empty"
 * for the wrong reason — callers still must check length.
 */
export function normalizeCartLineItems(raw: unknown): CartLineInput[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const out: CartLineInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const projectId = typeof record.projectId === 'string' ? record.projectId.trim() : '';
    const tokenCount = Number(record.tokenCount);
    if (!projectId) continue;
    if (!Number.isInteger(tokenCount) || tokenCount <= 0) continue;
    out.push({ projectId, tokenCount });
  }
  return out;
}
