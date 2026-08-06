import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls: Array<{ body: Record<string, unknown>; token: string | undefined }> = [];
let responseOk = true;

const originalFetch = globalThis.fetch;
const originalEnv = process.env;

beforeEach(() => {
  calls.length = 0;
  responseOk = true;
  process.env = { ...originalEnv };
  process.env.ALCHEMY_NOTIFY_AUTH_TOKEN = 'auth-token';
  process.env.ALCHEMY_WEBHOOK_ID = 'wh_1';

  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    calls.push({ body: JSON.parse(String(init.body)), token: headers['X-Alchemy-Token'] });
    return {
      ok: responseOk,
      status: responseOk ? 200 : 400,
      statusText: 'Bad Request',
      text: async () => 'nope'
    };
  }) as never;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
});

const load = () => import('./alchemyWebhookAddresses');

/**
 * A wallet the webhook does not watch is a wallet whose deposits are only found
 * by the block scan, and the scan only looks at a recent window. A wallet
 * created today and funded next week would fall in the gap.
 */
describe('watchAddressesForDeposits', () => {
  it('registers the addresses against the configured webhook', async () => {
    const { watchAddressesForDeposits } = await load();
    const result = await watchAddressesForDeposits(['0xabc', '0xdef']);

    expect(result).toEqual({ ok: true, added: 2 });
    expect(calls).toHaveLength(1);
    expect(calls[0].token).toBe('auth-token');
    expect(calls[0].body).toMatchObject({
      webhook_id: 'wh_1',
      addresses_to_add: ['0xabc', '0xdef'],
      addresses_to_remove: []
    });
  });

  it('drops duplicates and blanks rather than sending them', async () => {
    const { watchAddressesForDeposits } = await load();
    const result = await watchAddressesForDeposits(['0xabc', ' 0xabc ', '', '  ']);

    expect(result).toEqual({ ok: true, added: 1 });
    expect(calls[0].body.addresses_to_add).toEqual(['0xabc']);
  });

  /** Alchemy rejects a request carrying more than 500 addresses. */
  it('splits a list past the per-request limit', async () => {
    const { watchAddressesForDeposits } = await load();
    const many = Array.from({ length: 501 }, (_, index) => `0x${index}`);

    const result = await watchAddressesForDeposits(many);

    expect(result).toEqual({ ok: true, added: 501 });
    expect(calls).toHaveLength(2);
    expect((calls[0].body.addresses_to_add as string[]).length).toBe(500);
    expect((calls[1].body.addresses_to_add as string[]).length).toBe(1);
  });

  it('does nothing, successfully, when the webhook is not configured', async () => {
    delete process.env.ALCHEMY_WEBHOOK_ID;
    const { watchAddressesForDeposits } = await load();

    expect(await watchAddressesForDeposits(['0xabc'])).toMatchObject({
      ok: true,
      skipped: 'NOT_CONFIGURED'
    });
    expect(calls).toHaveLength(0);
  });

  it('reports a rejection instead of pretending it registered', async () => {
    responseOk = false;
    const { watchAddressesForDeposits } = await load();

    const result = await watchAddressesForDeposits(['0xabc']);
    expect(result.ok).toBe(false);
  });

  /**
   * Registration is a convenience over a slower path that still works, so it
   * must never be able to stop an investor from getting a wallet.
   */
  it('swallows failures when registering a single wallet', async () => {
    responseOk = false;
    const { watchInvestorWalletForDeposits } = await load();

    await expect(watchInvestorWalletForDeposits('0xabc')).resolves.toBeUndefined();
  });
});
