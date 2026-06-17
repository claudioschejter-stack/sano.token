import { describe, expect, it } from 'vitest';
import {
  buildDepositPaymentOptions,
  groupDepositPaymentOptions,
  sortDepositPaymentOptions
} from './depositPaymentOptions';
import { PAYMENT_CHECKOUT_GROUP_ORDER } from './paymentCheckoutCatalog';

describe('depositPaymentOptions', () => {
  it('groups checkout rows by catalog order for Argentina', () => {
    const quote = buildDepositPaymentOptions(100, 'AR', 1050, { linkedWalletAddress: null });
    const groupIds = quote.groups.map((group) => group.id);

    expect(groupIds).toEqual(
      PAYMENT_CHECKOUT_GROUP_ORDER.filter((id) => quote.groups.some((group) => group.id === id))
    );
    expect(quote.groups.find((group) => group.id === 'argentina')?.options.length).toBeGreaterThan(0);
    expect(quote.groups.some((group) => group.id === 'global_cards')).toBe(false);
    expect(quote.options.some((row) => row.provider === 'stripe')).toBe(false);
  });

  it('sorts configured options before unavailable ones at equal cost', () => {
    const quote = buildDepositPaymentOptions(50, 'AR', 1050, { linkedWalletAddress: '0xabc' });
    const sorted = sortDepositPaymentOptions(quote.options);
    const firstConfiguredIndex = sorted.findIndex((row) => row.configured);
    const firstUnavailableIndex = sorted.findIndex((row) => !row.configured);

    if (firstConfiguredIndex >= 0 && firstUnavailableIndex >= 0) {
      expect(firstConfiguredIndex).toBeLessThan(firstUnavailableIndex);
    }
  });

  it('partitions available and unavailable within each group', () => {
    const quote = buildDepositPaymentOptions(200, 'AR', 1050);
    const regrouped = groupDepositPaymentOptions(quote.options);

    for (const group of regrouped) {
      expect(group.available.every((row) => row.configured)).toBe(true);
      expect(group.unavailable.every((row) => !row.configured)).toBe(true);
      expect(group.options).toHaveLength(group.available.length + group.unavailable.length);
    }
  });

  it('purchase mode in Argentina excludes Mercado Pago and Stripe', () => {
    const quote = buildDepositPaymentOptions(100, 'AR', 1050, { linkedWalletAddress: '0xabc', mode: 'purchase' });
    expect(quote.options.some((row) => row.method === 'MERCADO_PAGO')).toBe(false);
    expect(quote.options.some((row) => row.provider === 'stripe')).toBe(false);
    expect(
      quote.options.some((row) => row.method === 'RIPIO' || row.method === 'TRANSAK' || row.method === 'BRIDGE')
    ).toBe(true);
  });
});
