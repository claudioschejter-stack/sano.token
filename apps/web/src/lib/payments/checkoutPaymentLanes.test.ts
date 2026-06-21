import { describe, expect, it } from 'vitest';
import type { DepositPaymentOption } from './depositPaymentOptions';
import { buildCheckoutPaymentLaneBundle, classifyCheckoutPaymentLane } from './checkoutPaymentLanes';

function option(id: string, overrides: Partial<DepositPaymentOption> = {}): DepositPaymentOption {
  return {
    id,
    groupId: 'argentina',
    method: 'LOCAL_RAIL',
    label: id,
    provider: 'dlocal',
    providerRail: id,
    platformFeeUsd: 1,
    gasFeeUsd: 0.1,
    networkFeeUsd: 0.1,
    feeUsd: 1.2,
    feeBps: 120,
    totalUsd: 101.2,
    totalLocal: 105000,
    displayCurrency: 'ARS',
    usesLocalCurrency: true,
    configured: true,
    sortOrder: 1,
    ...overrides
  };
}

const fiatLabels = {
  international_transfer: 'Transferencia internacional',
  debit_card: 'Tarjeta de débito',
  credit_card: 'Tarjeta de crédito'
} as const;

describe('checkoutPaymentLanes', () => {
  it('classifies crypto wallets separately from Mercado Pago', () => {
    expect(classifyCheckoutPaymentLane(option('metamask_usdc', { method: 'USDC_ONCHAIN', provider: 'usdc' }))).toBe(
      'crypto_wallet'
    );
    expect(
      classifyCheckoutPaymentLane(
        option('mercadopago_wallet', { method: 'MERCADO_PAGO', provider: 'mercado_pago', label: 'Mercado Pago' })
      )
    ).toBe('electronic_wallet');
  });

  it('builds three lanes with card backed by cheapest provider', () => {
    const bundle = buildCheckoutPaymentLaneBundle({
      country: 'AR',
      fiatOnRampLabels: fiatLabels,
      options: [
        option('metamask_usdc', { method: 'USDC_ONCHAIN', provider: 'usdc', totalUsd: 100.5 }),
        option('mercadopago_wallet', {
          method: 'MERCADO_PAGO',
          provider: 'mercado_pago',
          label: 'Mercado Pago',
          totalUsd: 102
        }),
        option('bridge', {
          method: 'BRIDGE',
          provider: 'bridge',
          groupId: 'international',
          totalUsd: 101,
          configured: true
        }),
        option('transak', {
          method: 'TRANSAK',
          provider: 'transak',
          groupId: 'international',
          totalUsd: 103,
          configured: true
        })
      ]
    });

    expect(bundle.optionsByLane.electronic_wallet.map((row) => row.id)).toContain('mercadopago_wallet');
    expect(bundle.optionsByLane.crypto_wallet.map((row) => row.id)).toContain('metamask_usdc');
    expect(bundle.cheapestCardBackend?.id).toBe('bridge');
    expect(bundle.optionsByLane.card).toHaveLength(3);
    expect(bundle.laneSummaries).toHaveLength(3);
  });
});
