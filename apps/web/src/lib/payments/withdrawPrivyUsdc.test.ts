import { beforeEach, describe, expect, it, vi } from 'vitest';

const SANOVA = '0x840aed84455C3a30Ef23a34a4D961BC3e1D06B41';
const EXTERNAL = '0x1111111111111111111111111111111111111111';

let balance: number | null = 100;
let linked: string | null = EXTERNAL;
let ownershipFails = false;
const transfers: Array<Record<string, unknown>> = [];
const movements: Array<Record<string, unknown>> = [];

vi.mock('@sanova/database', () => ({
  prisma: { investor: { findFirst: async () => ({ id: 'inv-1' }) } }
}));
vi.mock('../privy/resolveInvestorPrivyWalletId', () => ({
  resolveInvestorPrivyWalletIdForUser: async () => ({ walletId: 'w-1', address: SANOVA })
}));
vi.mock('../investor/linkedWalletPolicy', () => ({
  getLinkedWalletForUser: async () => linked
}));
vi.mock('../investor/linkedWalletsService', () => ({
  assertLinkedCryptoWalletOwnership: async (_userId: string, address: string) => {
    if (ownershipFails) throw new Error('WALLET_NOT_LINKED_TO_ACCOUNT');
    return address;
  }
}));
vi.mock('../portfolio/onChainUsdcReader', () => ({
  readWalletUsdcBalanceDetailed: async () => ({ balance })
}));
vi.mock('./baseUserPaysGasQuote', () => ({
  quoteBaseUserPaysGasUsd: async () => ({ networkFeeUsd: 0.02 })
}));
vi.mock('./paymentConfig', () => ({
  usdcDecimals: () => 6,
  usdcTokenAddress: () => '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
}));
vi.mock('../reconciliation/tokenMovementLedger', () => ({
  recordTokenMovement: async (input: Record<string, unknown>) => {
    movements.push(input);
  }
}));
vi.mock('../privy/walletTransferApi', () => ({
  privyTransferUsdc: async (input: Record<string, unknown>) => {
    transfers.push(input);
    return { actionId: 'a-1', status: 'pending', txHash: '0xhash' };
  },
  privyWaitForTransferTxHash: async () => '0xhash'
}));

const { withdrawPrivyUsdc, quotePrivyUsdcWithdrawal } = await import('./withdrawPrivyUsdc');

beforeEach(() => {
  balance = 100;
  linked = EXTERNAL;
  ownershipFails = false;
  transfers.length = 0;
  movements.length = 0;
});

/**
 * The balance was never locked by a contract — it simply had no route out of the
 * product, while the FAQ told investors they could withdraw at any time.
 */
describe('withdrawPrivyUsdc', () => {
  it('sends the requested amount to a linked wallet', async () => {
    const result = await withdrawPrivyUsdc({
      userId: 'u-1',
      amountUsdc: 25,
      destinationAddress: EXTERNAL
    });

    expect(result).toMatchObject({ ok: true, amountUsdc: '25.000000', destination: EXTERNAL });
    expect(transfers[0]).toMatchObject({ amountUsdc: 25, destinationAddress: EXTERNAL });
  });

  /** Gas comes out of the same balance, so "everything" cannot mean everything. */
  it('leaves the gas behind when withdrawing everything', async () => {
    const result = await withdrawPrivyUsdc({ userId: 'u-1' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Number(result.amountUsdc)).toBeLessThan(100);
      expect(Number(result.amountUsdc)).toBeGreaterThan(99.8);
      expect(Number(result.gasReserveUsdc)).toBeGreaterThan(0);
    }
  });

  /**
   * A session that can move funds anywhere turns an account takeover into a
   * theft, so the destination has to be one the account already linked.
   */
  it('refuses a destination the account never linked', async () => {
    ownershipFails = true;

    const result = await withdrawPrivyUsdc({
      userId: 'u-1',
      amountUsdc: 10,
      destinationAddress: '0x9999999999999999999999999999999999999999'
    });

    expect(result).toMatchObject({ ok: false, code: 'WALLET_NOT_LINKED_TO_ACCOUNT' });
    expect(transfers).toHaveLength(0);
  });

  it('refuses to send the money to the wallet it is already in', async () => {
    const result = await withdrawPrivyUsdc({
      userId: 'u-1',
      amountUsdc: 10,
      destinationAddress: SANOVA
    });

    expect(result).toMatchObject({ ok: false, code: 'DESTINATION_IS_SANOVA_WALLET' });
    expect(transfers).toHaveLength(0);
  });

  it('refuses an amount above what the gas reserve allows', async () => {
    const result = await withdrawPrivyUsdc({ userId: 'u-1', amountUsdc: 100 });

    expect(result).toMatchObject({ ok: false, code: 'AMOUNT_ABOVE_WITHDRAWABLE' });
    expect(transfers).toHaveLength(0);
  });

  it('explains a balance too small to cover its own gas', async () => {
    balance = 0.01;

    const result = await withdrawPrivyUsdc({ userId: 'u-1' });

    expect(result).toMatchObject({ ok: false, code: 'INSUFFICIENT_USDC_FOR_GAS' });
  });

  it('records the withdrawal in the ledger, in its own direction', async () => {
    await withdrawPrivyUsdc({ userId: 'u-1', amountUsdc: 25, destinationAddress: EXTERNAL });

    expect(movements[0]).toMatchObject({
      kind: 'USDC_INVESTOR_WITHDRAWAL',
      authoritative: true,
      fromAddress: SANOVA,
      toAddress: EXTERNAL,
      amountRaw: '25000000'
    });
  });

  it('asks for a destination when the account has none linked', async () => {
    linked = null;

    const result = await withdrawPrivyUsdc({ userId: 'u-1', amountUsdc: 10 });

    expect(result).toMatchObject({ ok: false, code: 'DESTINATION_ADDRESS_REQUIRED' });
  });

  /**
   * The request and the authorisation are separate moments, so the amount is
   * re-quoted before signing: a balance that moved in between must not produce a
   * transfer that reverts on the way out.
   */
  it('re-quotes at authorisation and refuses an amount that no longer fits', async () => {
    balance = 5;

    const result = await withdrawPrivyUsdc({ userId: 'u-1', amountUsdc: 25 });

    expect(result).toMatchObject({ ok: false, code: 'AMOUNT_ABOVE_WITHDRAWABLE' });
    expect(transfers).toHaveLength(0);
  });

  it('ties the Privy idempotency key to the authorisation, not the click', async () => {
    await withdrawPrivyUsdc({
      userId: 'u-1',
      amountUsdc: 10,
      destinationAddress: EXTERNAL,
      requestId: 'sanova-wallet-usdc-payout:wd-1'
    });

    expect(transfers[0]).toMatchObject({ idempotencyKey: 'sanova-wallet-usdc-payout:wd-1' });
  });
});

describe('quotePrivyUsdcWithdrawal', () => {
  it('quotes net of the fee without moving anything', async () => {
    const quote = await quotePrivyUsdcWithdrawal({ userId: 'u-1' });

    expect(quote.ok).toBe(true);
    if (quote.ok) {
      expect(quote.amountUsdc).toBeLessThan(quote.heldUsdc);
      expect(quote.gasReserveUsdc).toBeGreaterThan(0);
    }
    expect(transfers).toHaveLength(0);
  });
});
