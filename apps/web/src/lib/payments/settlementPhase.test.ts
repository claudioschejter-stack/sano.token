import { describe, expect, it } from 'vitest';
import { deriveSettlementPhase } from './settlementPhase';

describe('deriveSettlementPhase', () => {
  it('maps deposit statuses to settlement phases', () => {
    expect(
      deriveSettlementPhase({ kind: 'deposit', depositStatus: 'PENDING', depositMetadata: {} })
    ).toBe('awaiting_payment');
    expect(
      deriveSettlementPhase({
        kind: 'deposit',
        depositStatus: 'MANUAL_REVIEW',
        depositMetadata: {}
      })
    ).toBe('fiat_paid');
    expect(
      deriveSettlementPhase({
        kind: 'deposit',
        depositStatus: 'MANUAL_REVIEW',
        depositMetadata: { awaitingTreasuryUsdc: true }
      })
    ).toBe('awaiting_usdc');
    expect(
      deriveSettlementPhase({
        kind: 'deposit',
        depositStatus: 'CONFIRMED',
        depositMetadata: {}
      })
    ).toBe('confirmed');
  });

  it('maps cart confirmation and vault delivery', () => {
    expect(
      deriveSettlementPhase({
        kind: 'cart',
        cartAllConfirmed: false,
        cartIntents: [{ status: 'REQUIRES_PAYMENT', metadata: {} }]
      })
    ).toBe('awaiting_payment');

    expect(
      deriveSettlementPhase({
        kind: 'cart',
        cartAllConfirmed: false,
        cartIntents: [{ status: 'MANUAL_REVIEW', metadata: { awaitingTreasuryUsdc: true } }]
      })
    ).toBe('awaiting_usdc');

    expect(
      deriveSettlementPhase({
        kind: 'cart',
        cartAllConfirmed: true,
        cartIntents: [{ status: 'CONFIRMED', metadata: { purchaseMode: 'PLATFORM_BALANCE' } }]
      })
    ).toBe('rwa_delivered');

    expect(
      deriveSettlementPhase({
        kind: 'cart',
        cartAllConfirmed: true,
        cartIntents: [
          {
            status: 'CONFIRMED',
            metadata: {
              purchaseMode: 'ERC4626_DEPOSIT',
              vaultShareDeliveryStatus: 'PENDING'
            }
          }
        ]
      })
    ).toBe('confirmed');

    expect(
      deriveSettlementPhase({
        kind: 'cart',
        cartAllConfirmed: true,
        cartIntents: [
          {
            status: 'CONFIRMED',
            metadata: {
              purchaseMode: 'ERC4626_DEPOSIT',
              vaultShareDeliveryStatus: 'DELIVERED'
            }
          }
        ]
      })
    ).toBe('rwa_delivered');
  });
});
