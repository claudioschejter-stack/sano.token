import { describe, expect, it } from 'vitest';
import { isLocalRailManualResult, stripePaymentMethodTypes } from './stripeCheckoutOptions';

describe('stripeCheckoutOptions', () => {
  it('maps apple pay to card and link payment method types', () => {
    expect(stripePaymentMethodTypes('apple_pay')).toEqual(['card', 'link']);
  });

  it('detects local rail manual reconciliation metadata', () => {
    expect(isLocalRailManualResult({ mode: 'manual_reconciliation' })).toBe(true);
    expect(isLocalRailManualResult({ configured: true })).toBe(false);
  });
});
