import { beforeEach, describe, expect, it, vi } from 'vitest';

const upserts: Array<Record<string, unknown>> = [];
let byAccount: Record<string, unknown> | null = null;
let byCustomer: Record<string, unknown> | null = null;
let intents: Array<Record<string, unknown>> = [];

vi.mock('@sanova/database', () => ({
  prisma: {
    bridgeVirtualAccount: {
      upsert: async (args: Record<string, unknown>) => {
        upserts.push(args);
        return { id: 'bva-1' };
      },
      findUnique: async () => byAccount,
      findFirst: async () => byCustomer
    },
    paymentIntent: { findMany: async () => intents }
  }
}));

const { rememberVirtualAccount, resolveOpenBatchForUser, resolveVirtualAccountOwner } =
  await import('./bridgeVirtualAccountRegistry');

beforeEach(() => {
  upserts.length = 0;
  byAccount = null;
  byCustomer = null;
  intents = [];
});

describe('rememberVirtualAccount', () => {
  it('records who owns the account', async () => {
    await rememberVirtualAccount({
      virtualAccountId: 'va-1',
      bridgeCustomerId: 'cus-1',
      userId: 'u1',
      currency: 'USD'
    });
    expect((upserts[0].create as Record<string, unknown>).userId).toBe('u1');
    expect((upserts[0].create as Record<string, unknown>).currency).toBe('usd');
  });

  it('does nothing without an account or a user, instead of writing a broken row', async () => {
    await rememberVirtualAccount({
      virtualAccountId: '',
      bridgeCustomerId: 'cus-1',
      userId: 'u1',
      currency: 'usd'
    });
    await rememberVirtualAccount({
      virtualAccountId: 'va-1',
      bridgeCustomerId: 'cus-1',
      userId: '',
      currency: 'usd'
    });
    expect(upserts).toHaveLength(0);
  });
});

describe('resolveVirtualAccountOwner', () => {
  it('identifies the investor by the account that received the wire', async () => {
    byAccount = { userId: 'u1', virtualAccountId: 'va-1' };
    expect(await resolveVirtualAccountOwner({ virtualAccountId: 'va-1' })).toEqual({
      userId: 'u1',
      virtualAccountId: 'va-1'
    });
  });

  it('falls back to the customer when the account is unknown', async () => {
    byCustomer = { userId: 'u2', virtualAccountId: 'va-2' };
    expect(await resolveVirtualAccountOwner({ bridgeCustomerId: 'cus-2' })).toEqual({
      userId: 'u2',
      virtualAccountId: 'va-2'
    });
  });

  it('returns nothing rather than guessing when neither is known', async () => {
    expect(await resolveVirtualAccountOwner({ virtualAccountId: 'va-x' })).toBeNull();
  });
});

describe('resolveOpenBatchForUser', () => {
  it('returns the batch when the investor has exactly one open order', async () => {
    intents = [{ id: 'pi-1', metadata: { cartBatchId: 'batch-9' } }];
    expect(await resolveOpenBatchForUser('u1')).toBe('batch-9');
  });

  it('treats several intents of one batch as one order', async () => {
    intents = [
      { id: 'pi-1', metadata: { cartBatchId: 'batch-9' } },
      { id: 'pi-2', metadata: { cartBatchId: 'batch-9' } }
    ];
    expect(await resolveOpenBatchForUser('u1')).toBe('batch-9');
  });

  it('refuses to choose between two open orders', async () => {
    intents = [
      { id: 'pi-1', metadata: { cartBatchId: 'batch-9' } },
      { id: 'pi-2', metadata: { cartBatchId: 'batch-8' } }
    ];
    expect(await resolveOpenBatchForUser('u1')).toBeNull();
  });

  it('returns nothing when the investor has no open order', async () => {
    expect(await resolveOpenBatchForUser('u1')).toBeNull();
  });
});
