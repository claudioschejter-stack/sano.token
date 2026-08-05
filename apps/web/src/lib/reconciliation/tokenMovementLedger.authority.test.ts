import { beforeEach, describe, expect, it, vi } from 'vitest';

const upserts: Array<{ create: Record<string, unknown>; update: Record<string, unknown> }> = [];

vi.mock('@sanova/database', () => ({
  prisma: {
    tokenMovement: {
      upsert: async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        upserts.push(args);
        return { id: 'm1' };
      }
    }
  },
  Prisma: {}
}));

const { recordTokenMovement } = await import('./tokenMovementLedger');

const base = {
  asset: 'USDC' as const,
  contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  fromAddress: '0xa993743CFB85E8d6481Ef60bb3D397F49604A592',
  toAddress: '0x840aed84455C3a30Ef23a34a4D961BC3e1D06B41',
  amountRaw: '21000000',
  decimals: 6,
  txHash: '0xabc',
  logIndex: 0,
  blockNumber: 100
};

beforeEach(() => {
  upserts.length = 0;
});

describe('recordTokenMovement authority', () => {
  it('lets a caller that knows the intent correct an inferred kind', async () => {
    await recordTokenMovement({ ...base, kind: 'USDC_REFUND', authoritative: true });
    expect(upserts[0].update.kind).toBe('USDC_REFUND');
  });

  it('does not let an inferred kind overwrite what was already recorded', async () => {
    // A refund and a rent payout are both treasury to investor on-chain, so the
    // transfer indexer must not reclassify one as the other.
    await recordTokenMovement({ ...base, kind: 'USDC_RENT_PAYOUT' });
    expect(upserts[0].update.kind).toBeUndefined();
  });

  it('still sets the kind on the first write, inferred or not', async () => {
    await recordTokenMovement({ ...base, kind: 'USDC_RENT_PAYOUT' });
    expect(upserts[0].create.kind).toBe('USDC_RENT_PAYOUT');
  });

  it('keeps attaching ownership on later passes either way', async () => {
    await recordTokenMovement({ ...base, kind: 'USDC_PAYMENT', userId: 'u1', investorId: 'i1' });
    expect(upserts[0].update).toMatchObject({ userId: 'u1', investorId: 'i1' });
  });
});
