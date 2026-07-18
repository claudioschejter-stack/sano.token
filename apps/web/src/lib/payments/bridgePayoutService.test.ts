import { describe, expect, it } from 'vitest';
import {
  bridgeFiatDestinationRail,
  normalizeBridgeFiatPayoutCurrency
} from './bridgeClient';

describe('bridge fiat payout mapping', () => {
  it('maps currencies to Bridge destination rails', () => {
    expect(bridgeFiatDestinationRail('usd')).toBe('ach');
    expect(bridgeFiatDestinationRail('USD')).toBe('ach');
    expect(bridgeFiatDestinationRail('eur')).toBe('sepa');
    expect(bridgeFiatDestinationRail('mxn')).toBe('spei');
  });

  it('normalizes payout currency with usd default', () => {
    expect(normalizeBridgeFiatPayoutCurrency('EUR')).toBe('eur');
    expect(normalizeBridgeFiatPayoutCurrency('mxn')).toBe('mxn');
    expect(normalizeBridgeFiatPayoutCurrency(null)).toBe('usd');
    expect(normalizeBridgeFiatPayoutCurrency('gbp')).toBe('usd');
  });
});
