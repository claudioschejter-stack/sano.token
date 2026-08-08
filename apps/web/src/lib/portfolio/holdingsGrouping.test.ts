import { describe, expect, it } from 'vitest';

/**
 * Two purchases of the same asset are one position.
 *
 * The chain reports a single balance per wallet and project. Valuing per
 * purchase multiplied that whole balance once per row, so two purchases of one
 * token each read as two rows of $40 and the total came to $80 for $40 of
 * holdings — and the same number feeds the credit line, so the platform would
 * have lent against collateral that does not exist.
 */
type Purchase = { projectId: string; tokenCount: number; bookedUsd: number };

function positions(input: {
  purchases: Purchase[];
  onChainTokensByProject: Record<string, number>;
  pricePerToken: number;
}) {
  const byProject = new Map<string, Purchase[]>();
  for (const purchase of input.purchases) {
    const group = byProject.get(purchase.projectId);
    if (group) group.push(purchase);
    else byProject.set(purchase.projectId, [purchase]);
  }

  const rows = [...byProject.entries()].map(([projectId, group]) => {
    const onChainTokens = input.onChainTokensByProject[projectId] ?? 0;
    const onChainValue = onChainTokens * input.pricePerToken;
    const booked = group.reduce((sum, row) => sum + row.bookedUsd, 0);
    return {
      projectId,
      tokenCount: group.reduce((sum, row) => sum + row.tokenCount, 0),
      valueUsd: onChainValue > 0 ? onChainValue : booked,
      purchases: group.length
    };
  });

  return { rows, totalUsd: rows.reduce((sum, row) => sum + row.valueUsd, 0) };
}

describe('tenencias agrupadas por activo', () => {
  const pricePerToken = 20;

  it('dos compras de un token dan una fila de dos tokens a 40 dólares', () => {
    const result = positions({
      purchases: [
        { projectId: 'anelo', tokenCount: 1, bookedUsd: 20 },
        { projectId: 'anelo', tokenCount: 1, bookedUsd: 20 }
      ],
      onChainTokensByProject: { anelo: 2 },
      pricePerToken
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].tokenCount).toBe(2);
    expect(result.rows[0].valueUsd).toBe(40);
    expect(result.rows[0].purchases).toBe(2);
  });

  it('el total no se duplica: 40 de tenencia son 40 de cartera', () => {
    const result = positions({
      purchases: [
        { projectId: 'anelo', tokenCount: 1, bookedUsd: 20 },
        { projectId: 'anelo', tokenCount: 1, bookedUsd: 20 }
      ],
      onChainTokensByProject: { anelo: 2 },
      pricePerToken
    });

    expect(result.totalUsd).toBe(40);
  });

  it('el error crecía con cada compra, así que diez compras siguen siendo una fila', () => {
    const result = positions({
      purchases: Array.from({ length: 10 }, () => ({
        projectId: 'anelo',
        tokenCount: 1,
        bookedUsd: 20
      })),
      onChainTokensByProject: { anelo: 10 },
      pricePerToken
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].tokenCount).toBe(10);
    expect(result.totalUsd).toBe(200);
  });

  it('activos distintos siguen siendo filas distintas', () => {
    const result = positions({
      purchases: [
        { projectId: 'anelo', tokenCount: 2, bookedUsd: 40 },
        { projectId: 'otro', tokenCount: 1, bookedUsd: 20 }
      ],
      onChainTokensByProject: { anelo: 2, otro: 1 },
      pricePerToken
    });

    expect(result.rows).toHaveLength(2);
    expect(result.totalUsd).toBe(60);
  });

  it('sin lectura on-chain cae al valor de compra sumado, no al de una sola', () => {
    const result = positions({
      purchases: [
        { projectId: 'anelo', tokenCount: 1, bookedUsd: 20 },
        { projectId: 'anelo', tokenCount: 1, bookedUsd: 20 }
      ],
      onChainTokensByProject: {},
      pricePerToken
    });

    expect(result.rows[0].valueUsd).toBe(40);
    expect(result.totalUsd).toBe(40);
  });
});
