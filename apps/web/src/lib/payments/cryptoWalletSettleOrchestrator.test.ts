import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isPrivyAuthorizationSignerError,
  isPrivySessionOrWalletError,
  runCryptoWalletSettle,
  shouldSwitchToExternalWallet,
  type CryptoSettleDeps
} from './cryptoWalletSettleOrchestrator';

function deps(partial: Partial<CryptoSettleDeps>): CryptoSettleDeps {
  return {
    runServerPay: vi.fn(),
    grantServerSigner: vi.fn().mockResolvedValue(undefined),
    waitForPrivySession: vi.fn().mockResolvedValue({ address: '0xSanova' }),
    settleWithClientPrivy: vi.fn().mockResolvedValue(undefined),
    ensureBatchId: vi.fn().mockResolvedValue('cart-1'),
    expectedWalletAddress: '0xSanova',
    ...partial
  };
}

describe('cryptoWalletSettleOrchestrator helpers', () => {
  it('classifies Privy auth-key 401 as signer required', () => {
    expect(
      isPrivyAuthorizationSignerError(
        'PRIVY_SEND_TRANSACTION_FAILED:401 No valid authorization keys or user signing keys available'
      )
    ).toBe(true);
    expect(isPrivyAuthorizationSignerError('PRIVY_AUTHORIZATION_SIGNER_REQUIRED')).toBe(true);
  });

  it('treats PRIVY_SESSION_REQUIRED as external only when Sanova is underfunded', () => {
    expect(isPrivySessionOrWalletError('PRIVY_SESSION_REQUIRED')).toBe(true);
    expect(shouldSwitchToExternalWallet('PRIVY_SESSION_REQUIRED')).toBe(true);
    expect(
      shouldSwitchToExternalWallet('PRIVY_SESSION_REQUIRED', { hasSufficientSanovaBalance: true })
    ).toBe(false);
  });
});

describe('runCryptoWalletSettle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns settled when server pay succeeds on first try', async () => {
    const runServerPay = vi.fn().mockResolvedValue({
      ok: true,
      status: 'settled',
      batchId: 'cart-1',
      txHash: '0xabc',
      amountUsd: 20
    });
    const outcome = await runCryptoWalletSettle(deps({ runServerPay }));
    expect(outcome).toEqual({
      kind: 'settled',
      batchId: 'cart-1',
      txHash: '0xabc',
      amountUsd: 20,
      balanceUsdc: undefined
    });
    expect(runServerPay).toHaveBeenCalledTimes(1);
  });

  it('on signer-required: waits session, grants signer, retries server, settles', async () => {
    const runServerPay = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 'failed',
        error: 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED',
        batchId: 'cart-1',
        amountUsd: 20,
        balanceUsdc: 20
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 'settled',
        batchId: 'cart-1',
        txHash: '0xserver',
        amountUsd: 20,
        balanceUsdc: 0
      });
    const waitForPrivySession = vi.fn().mockResolvedValue({ address: '0xSanova' });
    const grantServerSigner = vi.fn().mockResolvedValue(undefined);
    const settleWithClientPrivy = vi.fn();

    const outcome = await runCryptoWalletSettle(
      deps({ runServerPay, waitForPrivySession, grantServerSigner, settleWithClientPrivy })
    );

    expect(waitForPrivySession).toHaveBeenCalledTimes(1);
    expect(grantServerSigner).toHaveBeenCalledTimes(1);
    expect(runServerPay).toHaveBeenCalledTimes(2);
    expect(settleWithClientPrivy).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('settled');
  });

  it('on signer-required after retry: falls back to client Privy settle', async () => {
    const runServerPay = vi.fn().mockResolvedValue({
      ok: false,
      status: 'failed',
      error: 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED',
      batchId: 'cart-1',
      amountUsd: 20,
      balanceUsdc: 20
    });
    const settleWithClientPrivy = vi.fn().mockResolvedValue(undefined);

    const outcome = await runCryptoWalletSettle(deps({ runServerPay, settleWithClientPrivy }));

    expect(settleWithClientPrivy).toHaveBeenCalledWith('cart-1', 20);
    expect(outcome).toMatchObject({ kind: 'settled', batchId: 'cart-1', amountUsd: 20 });
  });

  it('with funded Sanova balance: PRIVY_SESSION_REQUIRED stays on Sanova (never Mi wallet)', async () => {
    const runServerPay = vi.fn().mockResolvedValue({
      ok: false,
      status: 'failed',
      error: 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED',
      batchId: 'cart-1',
      amountUsd: 20,
      balanceUsdc: 20
    });
    const waitForPrivySession = vi.fn().mockRejectedValue(new Error('PRIVY_SESSION_REQUIRED'));

    const outcome = await runCryptoWalletSettle(
      deps({
        runServerPay,
        waitForPrivySession,
        hasSufficientSanovaBalance: true
      })
    );

    expect(outcome).toEqual({
      kind: 'failed',
      errorCode: 'PRIVY_SESSION_REQUIRED',
      switchToExternal: false,
      amountUsd: 20,
      balanceUsdc: 20,
      batchId: 'cart-1'
    });
  });

  it('infers funded Sanova from server balance/amount and blocks external switch', async () => {
    const runServerPay = vi.fn().mockResolvedValue({
      ok: false,
      status: 'failed',
      error: 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED',
      batchId: 'cart-1',
      amountUsd: 20,
      balanceUsdc: 20
    });
    const waitForPrivySession = vi.fn().mockRejectedValue(new Error('PRIVY_SESSION_REQUIRED'));

    const outcome = await runCryptoWalletSettle(deps({ runServerPay, waitForPrivySession }));

    expect(outcome).toMatchObject({
      kind: 'failed',
      errorCode: 'PRIVY_SESSION_REQUIRED',
      switchToExternal: false
    });
  });

  it('fails when Privy client wallet differs from funded Sanova address', async () => {
    const runServerPay = vi.fn().mockResolvedValue({
      ok: false,
      status: 'failed',
      error: 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED',
      amountUsd: 20,
      balanceUsdc: 20
    });
    const waitForPrivySession = vi.fn().mockResolvedValue({ address: '0xOtherWallet' });

    const outcome = await runCryptoWalletSettle(
      deps({
        runServerPay,
        waitForPrivySession,
        expectedWalletAddress: '0xSanova'
      })
    );

    expect(outcome).toMatchObject({
      kind: 'failed',
      errorCode: 'PRIVY_WALLET_ADDRESS_MISMATCH',
      // Funded Sanova balance inferred from server amount/balance → stay on Sanova.
      switchToExternal: false
    });
  });

  it('after grant+retry, unrelated server errors do not fall through to client settle', async () => {
    const runServerPay = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 'failed',
        error: 'PRIVY_AUTHORIZATION_SIGNER_REQUIRED',
        amountUsd: 20,
        balanceUsdc: 20
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 'failed',
        error: 'ALLOWLIST_NOT_APPROVED',
        amountUsd: 20,
        balanceUsdc: 20
      });
    const settleWithClientPrivy = vi.fn();

    const outcome = await runCryptoWalletSettle(deps({ runServerPay, settleWithClientPrivy }));

    expect(settleWithClientPrivy).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      kind: 'failed',
      errorCode: 'ALLOWLIST_NOT_APPROVED',
      switchToExternal: false
    });
  });

  it('does not attempt client settle when server fails for unrelated reasons', async () => {
    const runServerPay = vi.fn().mockResolvedValue({
      ok: false,
      status: 'failed',
      error: 'ALLOWLIST_NOT_APPROVED',
      amountUsd: 20
    });
    const waitForPrivySession = vi.fn();
    const settleWithClientPrivy = vi.fn();

    const outcome = await runCryptoWalletSettle(
      deps({ runServerPay, waitForPrivySession, settleWithClientPrivy })
    );

    expect(waitForPrivySession).not.toHaveBeenCalled();
    expect(settleWithClientPrivy).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      kind: 'failed',
      errorCode: 'ALLOWLIST_NOT_APPROVED',
      switchToExternal: false
    });
  });
});
