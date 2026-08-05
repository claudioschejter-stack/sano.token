import { beforeEach, describe, expect, it, vi } from 'vitest';

const upserts: Array<Record<string, unknown>> = [];
const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
const rentCredits: Array<Record<string, unknown>> = [];
const dispatched: Array<Record<string, unknown>> = [];

let payment: Record<string, unknown> | null = null;
let openIntents: Array<Record<string, unknown>> = [];
let projects: Array<Record<string, unknown>> = [];

vi.mock('@sanova/database', () => ({
  prisma: {
    unmatchedPayment: {
      upsert: async (args: Record<string, unknown>) => {
        upserts.push(args);
        return { id: 'up-1' };
      },
      findUnique: async () => payment,
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: args.where.id, data: args.data });
        return { id: args.where.id };
      }
    },
    paymentIntent: { findMany: async () => openIntents },
    project: { findMany: async () => projects }
  }
}));

vi.mock('./arsFxRate', () => ({ resolveArsPerUsd: () => 1000 }));
vi.mock('../yield/creditAndDistributeRent', () => ({
  creditAndDistributeOperatingRent: async (input: Record<string, unknown>) => {
    rentCredits.push(input);
    return { ok: true };
  }
}));
vi.mock('./localWalletWebhookSettlement', () => ({
  dispatchApprovedLocalWalletPayment: async (input: Record<string, unknown>) => {
    dispatched.push(input);
    return { ok: true };
  }
}));

const { recordUnmatchedPayment, resolveUnmatchedPayment, suggestMatches } = await import(
  './unmatchedPayments'
);

function pending(overrides: Record<string, unknown> = {}) {
  return {
    id: 'up-1',
    provider: 'macro_click',
    providerPaymentId: 'tx-1',
    amount: 21000,
    currency: 'ARS',
    amountUsd: 21,
    payerName: null,
    status: 'PENDING',
    ...overrides
  };
}

beforeEach(() => {
  upserts.length = 0;
  updates.length = 0;
  rentCredits.length = 0;
  dispatched.length = 0;
  payment = pending();
  openIntents = [];
  projects = [];
});

describe('recordUnmatchedPayment', () => {
  it('converts pesos to a dollar figure so it can be matched against orders', async () => {
    await recordUnmatchedPayment({
      provider: 'macro_click',
      providerPaymentId: 'tx-1',
      amount: 21000,
      currency: 'ARS'
    });
    expect((upserts[0].create as Record<string, unknown>).amountUsd).toBe(21);
  });

  it('keeps a dollar amount as it is', async () => {
    await recordUnmatchedPayment({
      provider: 'bridge',
      providerPaymentId: 'w-1',
      amount: 500,
      currency: 'usd'
    });
    const create = upserts[0].create as Record<string, unknown>;
    expect(create.amountUsd).toBe(500);
    expect(create.currency).toBe('USD');
  });

  it('does not revive a payment an admin already resolved', async () => {
    await recordUnmatchedPayment({
      provider: 'macro_click',
      providerPaymentId: 'tx-1',
      amount: 1,
      currency: 'ARS'
    });
    expect(Object.keys(upserts[0].update as Record<string, unknown>)).toEqual(['payload']);
  });
});

describe('suggestMatches', () => {
  it('suggests an open order whose total matches what arrived', async () => {
    openIntents = [
      { id: 'pi-1', amountUsd: 21, projectId: 'p1', metadata: { cartBatchId: 'batch-9' } }
    ];
    const suggestions = await suggestMatches('up-1');
    expect(suggestions[0]).toMatchObject({ kind: 'purchase', ref: 'batch-9' });
  });

  it('suggests a project when the payer names it', async () => {
    payment = pending({ payerName: 'Urban View' });
    projects = [{ id: 'proj-1', title: 'APART HOTEL URBAN VIEW' }];
    const suggestions = await suggestMatches('up-1');
    expect(suggestions.some((row) => row.kind === 'rent' && row.ref === 'proj-1')).toBe(true);
  });

  it('explains every suggestion, so the decision is reviewable', async () => {
    openIntents = [{ id: 'pi-1', amountUsd: 21, projectId: 'p1', metadata: {} }];
    const suggestions = await suggestMatches('up-1');
    expect(suggestions.every((row) => row.reason.length > 0)).toBe(true);
  });

  it('suggests nothing for a payment already resolved', async () => {
    payment = pending({ status: 'ASSIGNED' });
    expect(await suggestMatches('up-1')).toEqual([]);
  });
});

describe('resolveUnmatchedPayment', () => {
  it('credits rent to the project and distributes it', async () => {
    const result = await resolveUnmatchedPayment({
      paymentId: 'up-1',
      kind: 'rent',
      ref: 'proj-1'
    });
    expect(result.ok).toBe(true);
    expect(rentCredits[0]).toMatchObject({ projectId: 'proj-1', amount: 21000, currency: 'ARS' });
  });

  it('keys the credit on the payment, so assigning twice cannot pay twice', async () => {
    await resolveUnmatchedPayment({ paymentId: 'up-1', kind: 'rent', ref: 'proj-1' });
    expect(rentCredits[0].idempotencyKey).toBe('unmatched:up-1');
  });

  it('settles a purchase against its batch', async () => {
    const result = await resolveUnmatchedPayment({
      paymentId: 'up-1',
      kind: 'purchase',
      ref: 'batch-9'
    });
    expect(result.ok).toBe(true);
    expect(dispatched[0]).toMatchObject({ externalReference: 'batch-9' });
  });

  it('refuses to resolve one that was already resolved', async () => {
    payment = pending({ status: 'ASSIGNED' });
    const result = await resolveUnmatchedPayment({
      paymentId: 'up-1',
      kind: 'rent',
      ref: 'proj-1'
    });
    expect(result).toMatchObject({ ok: false, code: 'ALREADY_RESOLVED' });
    expect(rentCredits).toHaveLength(0);
  });

  it('requires a destination for anything other than dismissing', async () => {
    expect(await resolveUnmatchedPayment({ paymentId: 'up-1', kind: 'rent' })).toMatchObject({
      code: 'REF_REQUIRED'
    });
    expect(rentCredits).toHaveLength(0);
  });

  it('records a dismissal rather than deleting the row', async () => {
    const result = await resolveUnmatchedPayment({
      paymentId: 'up-1',
      kind: 'dismissed',
      note: 'no era nuestro'
    });
    expect(result.ok).toBe(true);
    expect(updates[0].data).toMatchObject({ status: 'DISMISSED', note: 'no era nuestro' });
  });

  it('reports a payment that does not exist', async () => {
    payment = null;
    expect(await resolveUnmatchedPayment({ paymentId: 'nope', kind: 'dismissed' })).toMatchObject({
      code: 'NOT_FOUND'
    });
  });
});
