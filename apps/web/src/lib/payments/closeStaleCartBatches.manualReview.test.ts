import { beforeEach, describe, expect, it, vi } from 'vitest';

type Intent = {
  id: string;
  projectId: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
  status: string;
};

let stored: Intent[] = [];
let lastWhere: Record<string, unknown> | null = null;
const updated: Array<{ id: string; data: Record<string, unknown> }> = [];
const released: string[] = [];

vi.mock('@sanova/database', () => ({
  prisma: {
    paymentIntent: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        lastWhere = args.where;
        return stored;
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updated.push({ id: args.where.id, data: args.data });
      }
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        paymentIntent: {
          update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
            updated.push({ id: args.where.id, data: args.data });
          }
        }
      })
  },
  Prisma: {}
}));

vi.mock('./paymentSupplyReservation', () => ({
  releaseSupplyForIntent: async (_tx: unknown, intent: Intent) => {
    released.push(intent.id);
  }
}));

const { expireStaleCartReservations } = await import('./closeStaleCartBatches');

function intent(overrides: Partial<Intent> = {}): Intent {
  return {
    id: 'intent-1',
    projectId: 'proj-1',
    tokenCount: 3,
    metadata: { supplyReserved: true },
    status: 'REQUIRES_PAYMENT',
    ...overrides
  };
}

beforeEach(() => {
  stored = [];
  updated.length = 0;
  released.length = 0;
  lastWhere = null;
});

describe('expireStaleCartReservations', () => {
  it('releases the supply of an expired checkout', async () => {
    stored = [intent()];
    const result = await expireStaleCartReservations();
    expect(result.releasedTokens).toBe(3);
    expect(released).toEqual(['intent-1']);
    expect(updated[0].data.status).toBe('EXPIRED');
    expect((updated[0].data.metadata as Record<string, unknown>).expiredReason).toBe(
      'RESERVATION_TTL_ELAPSED'
    );
  });

  it('also sweeps a payment stuck under review, which used to hold tokens forever', async () => {
    stored = [intent({ id: 'intent-review', status: 'MANUAL_REVIEW' })];
    const result = await expireStaleCartReservations();

    expect(result.releasedTokens).toBe(3);
    expect((updated[0].data.metadata as Record<string, unknown>).expiredReason).toBe(
      'MANUAL_REVIEW_HOLD_ELAPSED'
    );
  });

  it('gives a review a longer window than a checkout, not an unlimited one', async () => {
    vi.stubEnv('MANUAL_REVIEW_HOLD_MINUTES', '720');
    await expireStaleCartReservations();

    const branches = (lastWhere?.OR ?? []) as Array<Record<string, any>>;
    const review = branches.find((row) => row.status === 'MANUAL_REVIEW');
    const checkout = branches.find((row) => row.status?.in);

    expect(checkout.expiresAt.lte.getTime()).toBeGreaterThan(review.updatedAt.lte.getTime());
    vi.unstubAllEnvs();
  });

  it('caps the review window so a stuck payment cannot hold supply for weeks', async () => {
    vi.stubEnv('MANUAL_REVIEW_HOLD_MINUTES', '999999');
    await expireStaleCartReservations();

    const branches = (lastWhere?.OR ?? []) as Array<Record<string, any>>;
    const review = branches.find((row) => row.status === 'MANUAL_REVIEW');
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const age = Date.now() - review.updatedAt.lte.getTime();

    expect(age).toBeLessThanOrEqual(sevenDaysMs + 5_000);
    vi.unstubAllEnvs();
  });

  it('does not count tokens that were never reserved', async () => {
    stored = [intent({ metadata: {} })];
    const result = await expireStaleCartReservations();
    expect(result.releasedTokens).toBe(0);
    expect(result.expiredIntentIds).toEqual(['intent-1']);
  });
});
