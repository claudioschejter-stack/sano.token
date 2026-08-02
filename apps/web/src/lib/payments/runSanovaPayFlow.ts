import { normalizeCartLineItems } from './normalizeCartLineItems';
import type { CartLineInput } from './cartCheckoutService';

export type SanovaPayFlowResult = {
  ok: boolean;
  status?: string;
  error?: string;
  amountUsd?: number;
  balanceUsdc?: number | null;
  batchId?: string;
  txHash?: string;
};

export type SanovaPayFlowDeps = {
  items: CartLineInput[];
  clientBalanceUsdc: number | null;
  postPaySanova: (items: CartLineInput[], clientBalanceUsdc: number | null) => Promise<SanovaPayFlowResult>;
  postLegacySettle: (items: CartLineInput[], clientBalanceUsdc: number | null) => Promise<SanovaPayFlowResult>;
  createPendingCart: (items: CartLineInput[]) => Promise<string | null>;
  isHtmlOrMissingEndpoint?: (error?: string | null) => boolean;
};

function defaultIsHtml(error?: string | null): boolean {
  if (!error) return false;
  return (
    error === 'PAY_ENDPOINT_NOT_FOUND' ||
    error === 'INVALID_JSON_RESPONSE' ||
    error.endsWith('_HTML_RESPONSE')
  );
}

/**
 * Orchestrates Sanova one-tap pay with retries that never drop cart lines.
 * Extracted for unit coverage of the exact failure the checkout UI hit.
 */
export async function runSanovaPayFlow(deps: SanovaPayFlowDeps): Promise<SanovaPayFlowResult> {
  const items = normalizeCartLineItems(deps.items);
  if (!items.length) {
    return { ok: false, status: 'failed', error: 'NO_PENDING_PURCHASE' };
  }

  const isHtml = deps.isHtmlOrMissingEndpoint ?? defaultIsHtml;
  let result = await deps.postPaySanova(items, deps.clientBalanceUsdc);

  const code = String(result.error ?? result.status ?? '');
  if (code.toUpperCase() === 'NO_PENDING_PURCHASE' || code.toLowerCase() === 'no_pending_purchase') {
    await deps.createPendingCart(items);
    result = await deps.postPaySanova(items, deps.clientBalanceUsdc);
  }

  if (isHtml(result.error)) {
    await deps.createPendingCart(items).catch(() => null);
    result = await deps.postLegacySettle(items, deps.clientBalanceUsdc);
  }

  return result;
}
