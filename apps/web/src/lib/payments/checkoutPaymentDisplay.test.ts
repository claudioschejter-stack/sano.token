import { describe, expect, it } from 'vitest';
import type { DepositPaymentOption } from './depositPaymentOptions';
import {
  buildCheckoutDisplaySections,
  buildFiatOnRampDisplayId,
  parseFiatOnRampDisplayId,
  resolveCheckoutPaymentSelection,
  sortWalletCheckoutOptions
} from './checkoutPaymentDisplay';

function option(id: string, overrides: Partial<DepositPaymentOption> = {}): DepositPaymentOption {
  return {
    id,
    groupId: 'linked_wallet',
    method: 'USDC_ONCHAIN',
    label: id,
    provider: 'usdc',
    providerRail: id,
    platformFeeUsd: 1,
    gasFeeUsd: 0.1,
    networkFeeUsd: 0.1,
    feeUsd: 1.2,
    feeBps: 120,
    totalUsd: 101.2,
    totalLocal: null,
    displayCurrency: 'USD',
    usesLocalCurrency: false,
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

describe('checkoutPaymentDisplay', () => {
  it('orders wallet options for checkout', () => {
    const sorted = sortWalletCheckoutOptions([
      option('walletconnect_usdc'),
      option('binance_usdc'),
      option('electronic_wallet'),
      option('metamask_usdc')
    ]);
    expect(sorted.map((row) => row.id)).toEqual([
      'electronic_wallet',
      'metamask_usdc',
      'binance_usdc',
      'walletconnect_usdc'
    ]);
  });

  it('splits fiat on-ramps into three USD rows and keeps independent providers', () => {
    const sections = buildCheckoutDisplaySections(
      [
        option('electronic_wallet'),
        option('transak', { method: 'TRANSAK', groupId: 'international', configured: true }),
        option('bridge', { method: 'BRIDGE', groupId: 'international', configured: false }),
        option('ripio_on_ramp', { method: 'RIPIO', groupId: 'argentina', configured: true }),
        option('mercadopago_wallet', { method: 'MERCADO_PAGO', groupId: 'argentina', configured: true }),
        option('wise', { method: 'BRIDGE', groupId: 'international', configured: true })
      ],
      fiatLabels
    );

    expect(sections.walletOptions).toHaveLength(1);
    expect(sections.fiatOnRampBaseOption?.id).toBe('transak');
    expect(sections.fiatOnRampOptions).toHaveLength(3);
    expect(sections.fiatOnRampOptions.map((row) => row.label)).toEqual([
      'Transferencia internacional',
      'Tarjeta de débito',
      'Tarjeta de crédito'
    ]);
    expect(sections.fiatOnRampOptions.every((row) => row.usesLocalCurrency === false)).toBe(true);
    expect(sections.ripioEwalletOption?.id).toBe('ripio_on_ramp');
    expect(sections.independentOptions.map((row) => row.id)).toEqual(['mercadopago_wallet', 'wise']);
  });

  it('resolves fiat display ids to provider source and rail', () => {
    const displayId = buildFiatOnRampDisplayId('debit_card');
    expect(parseFiatOnRampDisplayId(displayId)).toBe('debit_card');
    expect(
      resolveCheckoutPaymentSelection(displayId, 'transak', null)
    ).toEqual({ paymentOptionId: 'transak', paymentOptionRail: 'debit_card' });
  });
});
