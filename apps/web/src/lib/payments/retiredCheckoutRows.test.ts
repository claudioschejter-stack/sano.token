import { describe, expect, it } from 'vitest';
import { PAYMENT_CHECKOUT_ROWS } from './paymentCheckoutCatalog';
import { checkoutRowAllowedForMode, isRetiredCheckoutRow } from './paymentCheckoutPolicy';

/**
 * Fourteen half-built providers are not fourteen options: they are fourteen ways
 * to fail, each of which has to be maintained, debugged and reconciled. What
 * stays is what works end to end.
 */
describe('retired checkout rows', () => {
  const providersFor = (mode: 'purchase' | 'deposit') =>
    new Set(
      PAYMENT_CHECKOUT_ROWS.filter((row) => checkoutRowAllowedForMode(row, mode)).map(
        (row) => row.provider
      )
    );

  it('hides the providers that never worked end to end', () => {
    for (const mode of ['purchase', 'deposit'] as const) {
      const providers = providersFor(mode);
      for (const retired of ['ramp', 'wise', 'astropay', 'ebanx', 'stripe']) {
        expect(providers.has(retired as never), `${retired} in ${mode}`).toBe(false);
      }
    }
  });

  /**
   * Ripio is the one that collects pesos on a CVU and sends USDC to the Base
   * treasury, which is the only automatic path Argentina has. Retiring it would
   * have left the country without a wallet rail.
   */
  it('keeps the ones that do: USDC, Macro, Bridge and Ripio', () => {
    const providers = providersFor('purchase');
    expect(providers.has('usdc')).toBe(true);
    expect(providers.has('macro_click')).toBe(true);
    expect(providers.has('bridge')).toBe(true);
    expect(providers.has('ripio')).toBe(true);
  });

  it('keeps the Privy card on-ramp', () => {
    const privyRow = PAYMENT_CHECKOUT_ROWS.find((row) => row.id === 'privy_on_ramp');
    expect(privyRow).toBeDefined();
    expect(isRetiredCheckoutRow(privyRow!)).toBe(false);
    expect(checkoutRowAllowedForMode(privyRow!, 'purchase')).toBe(true);
  });

  it('retires by provider, so a row is judged by who collects the money', () => {
    const retired = PAYMENT_CHECKOUT_ROWS.find((row) => row.provider === 'wise');
    expect(retired).toBeDefined();
    expect(isRetiredCheckoutRow(retired!)).toBe(true);
  });
});
