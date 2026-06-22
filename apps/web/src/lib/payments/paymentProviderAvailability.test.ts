import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { PaymentCheckoutRow } from './paymentCheckoutCatalog';
import { isDepositCheckoutRowConfigured } from './paymentProviderAvailability';

function row(overrides: Partial<PaymentCheckoutRow>): PaymentCheckoutRow {
  return {
    id: 'mercadopago_wallet',
    groupId: 'argentina',
    method: 'MERCADO_PAGO',
    label: 'Mercado Pago',
    provider: 'mercado_pago',
    providerRail: 'wallet_embedded',
    fallbackFeeBps: 280,
    fallbackGasUsd: 0,
    fallbackNetworkUsd: 0.03,
    usesLocalCurrency: true,
    countries: ['AR'],
    sortOrder: 105,
    ...overrides
  };
}

describe('isDepositCheckoutRowConfigured', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('enables Mercado Pago embedded when MP credentials exist (without Ripio)', () => {
    process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-test';
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY = 'APP_USR-public';
    delete process.env.RIPIO_CLIENT_ID;
    delete process.env.RIPIO_CLIENT_SECRET;

    expect(isDepositCheckoutRowConfigured(row({ id: 'mercadopago_wallet' }))).toBe(true);
  });

  it('allows USDC wallet rows without a pre-linked wallet', () => {
    process.env.BASE_USDC_TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    process.env.BASE_STABLECOIN_TREASURY_ADDRESS = '0x1234567890123456789012345678901234567890';

    expect(
      isDepositCheckoutRowConfigured(
        row({
          id: 'metamask_usdc',
          method: 'USDC_ONCHAIN',
          provider: 'usdc',
          providerRail: 'metamask_usdc'
        }),
        { linkedWalletAddress: null }
      )
    ).toBe(true);
  });
});
