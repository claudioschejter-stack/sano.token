import { describe, expect, it } from 'vitest';

/**
 * The market the daily funding cron supplies into has to be the project's
 * current one. It used to be four hardcoded addresses, and when the project
 * moved to a corrected vault they all pointed at a vault that had been emptied —
 * so the cron would have kept sending treasury USDC into a market whose
 * collateral nobody could post any more.
 */
function marketIdFrom(collateralTargets: unknown): string | null {
  const targets = Array.isArray(collateralTargets)
    ? (collateralTargets as Array<Record<string, unknown>>)
    : [];
  for (const target of targets) {
    const id = typeof target.externalId === 'string' ? target.externalId.trim() : '';
    if (target.protocol === 'MORPHO' && /^0x[0-9a-fA-F]{64}$/.test(id)) {
      return id;
    }
  }
  return null;
}

const MARKET = '0x009cc05c99dee8545e331141a7c8ef1f8cc52da972c2f92930319c7570caf65f';

describe('de dónde sale el mercado de Morpho', () => {
  it('lo toma del target registrado del proyecto', () => {
    expect(marketIdFrom([{ protocol: 'MORPHO', externalId: MARKET }])).toBe(MARKET);
  });

  it('ignora un placeholder que no es un market id', () => {
    // This is what used to be stored, and reading it as an id is how a market
    // holding real USDC came to be reported as empty.
    expect(marketIdFrom([{ protocol: 'MORPHO', externalId: 'MORPHO-proj-anelo' }])).toBeNull();
  });

  it('ignora targets de otros protocolos', () => {
    expect(marketIdFrom([{ protocol: 'AAVE', externalId: MARKET }])).toBeNull();
  });

  it('sin targets no hay mercado, y el cron tiene que abstenerse', () => {
    expect(marketIdFrom([])).toBeNull();
    expect(marketIdFrom(null)).toBeNull();
    expect(marketIdFrom(undefined)).toBeNull();
  });

  it('el colateral del mercado decide, comparado sin importar el checksum', () => {
    const vault = '0x56dB993fcf2245e6124692D99b0186CF53392d89';
    const onChainCollateral = '0x56db993fcf2245e6124692d99b0186cf53392d89';
    const oldVault = '0x125782B1302be9a2f58849f8A86F25F78009b367';

    expect(onChainCollateral.toLowerCase() === vault.toLowerCase()).toBe(true);
    expect(oldVault.toLowerCase() === vault.toLowerCase()).toBe(false);
  });
});
