import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDepositPaymentOptions, getPaymentCheckoutRowById } from './depositPaymentOptions';
import { PRIVY_ON_RAMP_OPTION_ID } from './privyOnRampPolicy';

/**
 * An aggregator used to sit behind the per-wallet local rails of most countries
 * and it is gone. These cover what a buyer is actually offered now: the Privy
 * on-ramp everywhere those rails used to be.
 */
describe('paymentRoutePolicy', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'privy-test';
  });

  afterEach(() => {
    process.env = env;
  });

  it('no longer offers the rails that only existed through the aggregator', () => {
    for (const id of ['spei', 'phonepe', 'pix', 'modo', 'brubank', 'galicia']) {
      expect(getPaymentCheckoutRowById(id)).toBeNull();
    }
  });

  it('routes MX through the Privy on-ramp', () => {
    const quote = buildDepositPaymentOptions(100, 'MX', 17.5, { mode: 'purchase' });
    expect(quote.options.some((row) => row.id === 'spei')).toBe(false);
    expect(quote.options.find((row) => row.id === PRIVY_ON_RAMP_OPTION_ID)?.configured).toBe(true);
  });

  it('routes IN through the Privy on-ramp', () => {
    const quote = buildDepositPaymentOptions(100, 'IN', 83, { mode: 'purchase' });
    expect(quote.options.some((row) => row.id === 'phonepe')).toBe(false);
    expect(quote.options.find((row) => row.id === PRIVY_ON_RAMP_OPTION_ID)?.configured).toBe(true);
  });

  it('routes GB through the Privy on-ramp', () => {
    const quote = buildDepositPaymentOptions(100, 'GB', 0.79, { mode: 'purchase' });
    expect(quote.options.find((row) => row.id === PRIVY_ON_RAMP_OPTION_ID)?.configured).toBe(true);
  });

  it('still offers Argentina its own rails, which never went through an aggregator', () => {
    const quote = buildDepositPaymentOptions(100, 'AR', 1050, { mode: 'purchase' });
    expect(quote.options.length).toBeGreaterThan(0);
    // Mercado Pago, Macro and USDC survive; the aggregator-backed wallets do not.
    expect(quote.options.some((row) => row.id === 'modo')).toBe(false);
  });
});
