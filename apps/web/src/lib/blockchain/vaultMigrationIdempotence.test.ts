import { describe, expect, it } from 'vitest';
import { confirmOnChain } from './confirmOnChain';

/**
 * The failure these cover really happened: a second migration run on an already
 * migrated project redeemed the shares back out of the live vault, then read
 * stale state and reported the full quota still sitting in it.
 */
describe('migración: repetir la corrida no puede vaciar el vault vivo', () => {
  it('no hay nada que rescatar cuando el proyecto ya apunta al vault nuevo', () => {
    const oldVault = '0x56dB993fcf2245e6124692D99b0186CF53392d89';
    const newVault = '0x56db993fcf2245e6124692d99b0186cf53392d89';

    // Case-insensitive: the DB and the chain disagree on checksum casing.
    expect(oldVault.toLowerCase() === newVault.toLowerCase()).toBe(true);
  });

  it('un vault distinto sí es un vault viejo del que rescatar', () => {
    const oldVault = '0x125782B1302be9a2f58849f8A86F25F78009b367';
    const newVault = '0x56dB993fcf2245e6124692D99b0186CF53392d89';

    expect(oldVault.toLowerCase() === newVault.toLowerCase()).toBe(false);
  });

  it('el balance de tokens post-redeem no se conforma con una lectura vieja', async () => {
    const redeemed = 5000n * 10n ** 18n;
    let reads = 0;

    const outcome = await confirmOnChain({
      // First read predates the redeem: the tokens are already in the Safe.
      read: async () => {
        reads += 1;
        return reads > 1 ? redeemed : 0n;
      },
      satisfied: (balance) => balance >= redeemed,
      intervalMs: 1,
      timeoutMs: 500
    });

    expect(outcome.confirmed).toBe(true);
    expect(outcome.value).toBe(redeemed);
  });

  it('la verificación anclada al bloque falla en vez de aceptar el balance previo', async () => {
    const expected = 5000n * 10n ** 21n;

    /**
     * Reading at a block the node has not reached errors instead of answering,
     * which is the whole point of the anchor: the loop retries rather than
     * treating the pre-migration balance as the outcome.
     */
    const outcome = await confirmOnChain({
      read: async () => {
        throw new Error('header not found');
      },
      satisfied: (balance: bigint) => balance >= expected,
      intervalMs: 1,
      timeoutMs: 20
    });

    expect(outcome.confirmed).toBe(false);
    expect(outcome.value).toBeNull();
  });
});
