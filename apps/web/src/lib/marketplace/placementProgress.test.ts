import { describe, expect, it } from 'vitest';
import { placementProgress } from './placementProgress';

describe('progreso de colocación', () => {
  it('dos tokens vendidos de 5000 no son cero', () => {
    // What was on screen: the bar said 0% while two tokens were already placed.
    const result = placementProgress({ availableTokens: 4998, totalTokens: 5000 });

    expect(result.label).toBe('<1%');
    expect(result.placedTokens).toBe(2);
    expect(result.percent).toBeGreaterThan(0);
  });

  it('el conteo se cuenta igual que la barra, así no se contradicen', () => {
    const result = placementProgress({ availableTokens: 4998, totalTokens: 5000 });
    expect(result.placedTokens).toBe(2);
  });

  it('cien por ciento significa agotado, no casi', () => {
    // 4999 of 5000 rounds to 100, and 100% has to mean there is nothing left.
    const almost = placementProgress({ availableTokens: 1, totalTokens: 5000 });
    expect(almost.label).toBe('>99%');
    expect(almost.percent).toBeLessThan(100);

    const soldOut = placementProgress({ availableTokens: 0, totalTokens: 5000 });
    expect(soldOut.label).toBe('100%');
    expect(soldOut.percent).toBe(100);
  });

  it('sin nada colocado es cero de verdad', () => {
    const result = placementProgress({ availableTokens: 5000, totalTokens: 5000 });
    expect(result.label).toBe('0%');
    expect(result.percent).toBe(0);
    expect(result.placedTokens).toBe(0);
  });

  it('los porcentajes normales se redondean como antes', () => {
    expect(placementProgress({ availableTokens: 2500, totalTokens: 5000 }).label).toBe('50%');
    expect(placementProgress({ availableTokens: 1000, totalTokens: 5000 }).label).toBe('80%');
  });

  it('un proyecto sin tokens no rompe la división', () => {
    const result = placementProgress({ availableTokens: 0, totalTokens: 0 });
    expect(result).toEqual({ percent: 0, label: '0%', placedTokens: 0 });
  });

  it('más disponibles que el total no produce un negativo', () => {
    // Bad data should read as "nothing placed", never as a negative bar.
    const result = placementProgress({ availableTokens: 6000, totalTokens: 5000 });
    expect(result.placedTokens).toBe(0);
    expect(result.percent).toBe(0);
  });
});
