import { describe, expect, it } from 'vitest';
import { summarizeCartSettlement } from './cartSettlementConfirmation';

describe('summarizeCartSettlement', () => {
  it('is not successful before payment confirms', () => {
    const summary = summarizeCartSettlement([
      { status: 'REQUIRES_PAYMENT', tokenCount: 1, metadata: { purchaseMode: 'ERC4626_DEPOSIT' } }
    ]);
    expect(summary.paid).toBe(false);
    expect(summary.tokensDelivered).toBe(false);
  });

  it('reports paid but pending while vault shares are being delivered', () => {
    const summary = summarizeCartSettlement([
      {
        status: 'CONFIRMED',
        txHash: '0xtreasury',
        tokenCount: 1,
        metadata: { purchaseMode: 'ERC4626_DEPOSIT' }
      }
    ]);
    expect(summary.paid).toBe(true);
    expect(summary.treasuryTxHash).toBe('0xtreasury');
    expect(summary.deliveryPending).toBe(true);
    expect(summary.tokensDelivered).toBe(false);
  });

  it('is successful once payment and share delivery both land', () => {
    const summary = summarizeCartSettlement([
      {
        status: 'CONFIRMED',
        txHash: '0xtreasury',
        tokenCount: 2,
        metadata: {
          purchaseMode: 'ERC4626_DEPOSIT',
          vaultShareDeliveryStatus: 'DELIVERED',
          vaultShareDeliveryTxHash: '0xshares'
        }
      }
    ]);
    expect(summary.paid).toBe(true);
    expect(summary.tokensDelivered).toBe(true);
    expect(summary.deliveryPending).toBe(false);
    expect(summary.shareTxHashes).toEqual(['0xshares']);
    expect(summary.tokenCount).toBe(2);
  });

  it('flags delivery failures so paid investors are not shown success', () => {
    const summary = summarizeCartSettlement([
      {
        status: 'CONFIRMED',
        txHash: '0xtreasury',
        tokenCount: 1,
        metadata: {
          purchaseMode: 'ERC4626_DEPOSIT',
          vaultShareDeliveryStatus: 'TREASURY_NO_SHARES'
        }
      }
    ]);
    expect(summary.paid).toBe(true);
    expect(summary.tokensDelivered).toBe(false);
    expect(summary.deliveryFailed).toBe(true);
  });

  it('treats non-vault confirmed lines as delivered', () => {
    const summary = summarizeCartSettlement([
      { status: 'CONFIRMED', txHash: '0xtreasury', tokenCount: 1, metadata: {} }
    ]);
    expect(summary.tokensDelivered).toBe(true);
  });

  it('requires every line to be delivered', () => {
    const summary = summarizeCartSettlement([
      {
        status: 'CONFIRMED',
        txHash: '0xtreasury',
        tokenCount: 1,
        metadata: {
          purchaseMode: 'ERC4626_DEPOSIT',
          vaultShareDeliveryStatus: 'DELIVERED',
          vaultShareDeliveryTxHash: '0xshares'
        }
      },
      {
        status: 'CONFIRMED',
        txHash: '0xtreasury',
        tokenCount: 1,
        metadata: { purchaseMode: 'ERC4626_DEPOSIT' }
      }
    ]);
    expect(summary.tokensDelivered).toBe(false);
    expect(summary.deliveryPending).toBe(true);
  });
});
