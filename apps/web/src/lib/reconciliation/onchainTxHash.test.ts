import { describe, expect, it } from 'vitest';

/**
 * What separates a purchase that happened from one that was written into the
 * database. A real one carries a 32 byte transaction hash; the demo rows carry
 * strings like `seed-claudio-proj-anelo-services`, and nothing in the platform
 * was checking the difference.
 */
const ONCHAIN_TX = /^0x[0-9a-fA-F]{64}$/;

describe('qué cuenta como una compra respaldada por la cadena', () => {
  it('acepta los hashes reales de las compras de AÑELO', () => {
    expect(
      ONCHAIN_TX.test('0x7fb4caed3b419643443fd329c6ae754a192a9761bc3704817f46258f2a4c42ed')
    ).toBe(true);
    expect(
      ONCHAIN_TX.test('0x3ec141c102a6853af6097e2a4f896791d5509f5b747589e6471c18fb2ff935c9')
    ).toBe(true);
  });

  it('rechaza los marcadores que dejó el script de demo', () => {
    expect(ONCHAIN_TX.test('seed-claudio-proj-anelo-services')).toBe(false);
    expect(ONCHAIN_TX.test('seed-claudio-proj-rincon-logistics')).toBe(false);
  });

  it('rechaza lo que se parece pero no lo es', () => {
    // Missing the 0x, too short, too long, or not hex at all.
    expect(ONCHAIN_TX.test('7fb4caed3b419643443fd329c6ae754a192a9761bc3704817f46258f2a4c42ed')).toBe(
      false
    );
    expect(ONCHAIN_TX.test('0xabc')).toBe(false);
    expect(ONCHAIN_TX.test(`0x${'a'.repeat(65)}`)).toBe(false);
    expect(ONCHAIN_TX.test(`0x${'z'.repeat(64)}`)).toBe(false);
    expect(ONCHAIN_TX.test('')).toBe(false);
  });

  it('acepta mayúsculas, que algunos exploradores devuelven así', () => {
    expect(ONCHAIN_TX.test(`0x${'A'.repeat(64)}`)).toBe(true);
  });
});
