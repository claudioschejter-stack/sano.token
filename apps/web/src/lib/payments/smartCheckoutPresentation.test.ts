import { describe, expect, it } from 'vitest';
import { buildSmartCheckoutPresentation } from './smartCheckoutPresentation';
import type { DepositPaymentOption } from './depositPaymentOptions';

const sampleOption: DepositPaymentOption = {
  id: 'modo',
  groupId: 'argentina',
  method: 'LOCAL_RAIL',
  label: 'Modo',
  provider: 'dlocal',
  providerRail: 'modo_qr',
  platformFeeUsd: 1,
  gasFeeUsd: 0,
  networkFeeUsd: 0.02,
  feeUsd: 1.02,
  feeBps: 100,
  totalUsd: 101.02,
  totalLocal: 105000,
  displayCurrency: 'ARS',
  usesLocalCurrency: true,
  configured: true,
  stablecoinNetwork: 'BASE',
  sortOrder: 100
};

describe('smartCheckoutPresentation', () => {
  it('builds headline and fiat subheadline for best local option', () => {
    const presentation = buildSmartCheckoutPresentation({
      amountUsd: 100,
      localCurrency: 'ARS',
      bestOption: sampleOption
    });

    expect(presentation.bestOptionId).toBe('modo');
    expect(presentation.tokenAmountUsdc).toBe(100);
    expect(presentation.headline).toContain('Argentina');
    expect(presentation.subheadline).toContain('Modo');
    expect(presentation.subheadline).toContain('USDC (Base): 100.00');
  });

  it('handles missing options', () => {
    const presentation = buildSmartCheckoutPresentation({
      amountUsd: 50,
      localCurrency: 'USD',
      bestOption: null
    });
    expect(presentation.bestOptionId).toBeNull();
    expect(presentation.headline).toContain('Sin métodos');
  });
});
