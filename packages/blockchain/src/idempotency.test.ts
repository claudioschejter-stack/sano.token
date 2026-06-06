import { describe, expect, it, vi } from 'vitest';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { claimBlockchainEvent } from './idempotency';

describe('claimBlockchainEvent', () => {
  it('returns false without txHash', async () => {
    const tx = { blockchainEvent: { create: vi.fn() } };
    const result = await claimBlockchainEvent(tx as never, {
      eventName: 'Transfer',
      txHash: ''
    });
    expect(result).toBe(false);
    expect(tx.blockchainEvent.create).not.toHaveBeenCalled();
  });

  it('returns true on first insert', async () => {
    const tx = { blockchainEvent: { create: vi.fn().mockResolvedValue({}) } };
    const result = await claimBlockchainEvent(tx as never, {
      eventName: 'Transfer',
      txHash: '0xabc',
      contractAddress: '0x1'
    });
    expect(result).toBe(true);
  });

  it('returns false on duplicate P2002', async () => {
    const duplicate = new PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '6.0.0'
    });
    const tx = { blockchainEvent: { create: vi.fn().mockRejectedValue(duplicate) } };
    const result = await claimBlockchainEvent(tx as never, {
      eventName: 'Transfer',
      txHash: '0xabc'
    });
    expect(result).toBe(false);
  });
});
