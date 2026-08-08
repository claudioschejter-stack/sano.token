import { describe, expect, it } from 'vitest';

/**
 * What counts as collateral, and therefore what the credit line stands on.
 *
 * The old rule fell back to the booked purchase price when the chain showed
 * nothing, so demo rows written by a seeding script became borrowable collateral
 * — 6.2 million dollars of it, against tokens that exist nowhere.
 */
function collateralUsd(
  positions: Array<{ onChainTokens: number; pricePerToken: number; bookedUsd: number }>
): number {
  return positions.reduce((sum, row) => sum + row.onChainTokens * row.pricePerToken, 0);
}

describe('el colateral es lo que la cadena confirma', () => {
  it('cuenta los tokens que están realmente en la wallet', () => {
    expect(
      collateralUsd([{ onChainTokens: 2, pricePerToken: 20, bookedUsd: 40 }])
    ).toBe(40);
  });

  it('una fila sin nada on-chain no aporta colateral, aunque tenga monto contabilizado', () => {
    // A seeded row: 25000 tokens booked at 2.499.750, zero on chain.
    expect(
      collateralUsd([{ onChainTokens: 0, pricePerToken: 99.99, bookedUsd: 2_499_750 }])
    ).toBe(0);
  });

  it('una compra real sin entregar tampoco aporta todavía', () => {
    // Not a mistake: you cannot borrow against shares you have not received.
    expect(collateralUsd([{ onChainTokens: 0, pricePerToken: 20, bookedUsd: 20 }])).toBe(0);
  });

  it('mezcla real y no respaldado sin contaminarse', () => {
    const total = collateralUsd([
      { onChainTokens: 2, pricePerToken: 20, bookedUsd: 40 },
      { onChainTokens: 0, pricePerToken: 50, bookedUsd: 99_980 },
      { onChainTokens: 0, pricePerToken: 100, bookedUsd: 2_499_750 }
    ]);

    expect(total).toBe(40);
  });

  it('el credito disponible es un porcentaje de eso, asi que cae con el', () => {
    const ltv = 0.625;
    const total = collateralUsd([
      { onChainTokens: 2, pricePerToken: 20, bookedUsd: 40 },
      { onChainTokens: 0, pricePerToken: 50, bookedUsd: 99_980 }
    ]);

    expect(Number((total * ltv).toFixed(2))).toBe(25);
  });
});
