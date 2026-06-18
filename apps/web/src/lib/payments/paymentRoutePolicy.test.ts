import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDepositPaymentOptions } from './depositPaymentOptions';
import { PRIVY_ON_RAMP_OPTION_ID } from './privyOnRampPolicy';
import { checkoutRowAllowedForMode } from './paymentCheckoutPolicy';
import { getPaymentCheckoutRowById } from './depositPaymentOptions';

describe('paymentRoutePolicy', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('MX purchase: SPEI visible when dLocal configured, Privy hidden', () => {
    process.env.DLOCAL_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'privy-test';

    const spei = getPaymentCheckoutRowById('spei');
    expect(spei).not.toBeNull();
    expect(checkoutRowAllowedForMode(spei!, 'purchase')).toBe(true);

    const quote = buildDepositPaymentOptions(100, 'MX', 17.5, { mode: 'purchase' });
    expect(quote.options.some((row) => row.id === 'spei' && row.configured)).toBe(true);
    expect(quote.options.find((row) => row.id === PRIVY_ON_RAMP_OPTION_ID)?.configured).toBe(false);
  });

  it('IN purchase: UPI (PhonePe) visible when dLocal configured, Privy hidden', () => {
    process.env.DLOCAL_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'privy-test';

    const quote = buildDepositPaymentOptions(100, 'IN', 83, { mode: 'purchase' });
    expect(quote.options.some((row) => row.id === 'phonepe' && row.configured)).toBe(true);
    expect(quote.options.find((row) => row.id === PRIVY_ON_RAMP_OPTION_ID)?.configured).toBe(false);
  });

  it('GB purchase: Privy on-ramp when configured (no dLocal local rails)', () => {
    process.env.DLOCAL_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'privy-test';

    const quote = buildDepositPaymentOptions(100, 'GB', 0.79, { mode: 'purchase' });
    expect(quote.options.find((row) => row.id === PRIVY_ON_RAMP_OPTION_ID)?.configured).toBe(true);
  });

  it('MX: Privy visible only when dLocal is not configured', () => {
    delete process.env.DLOCAL_API_KEY;
    delete process.env.LOCAL_RAILS_ENABLED;
    process.env.NEXT_PUBLIC_PRIVY_APP_ID = 'privy-test';

    const quote = buildDepositPaymentOptions(100, 'MX', 17.5, { mode: 'purchase' });
    expect(quote.options.some((row) => row.id === 'spei' && row.configured)).toBe(false);
    expect(quote.options.find((row) => row.id === PRIVY_ON_RAMP_OPTION_ID)?.configured).toBe(true);
  });
});
