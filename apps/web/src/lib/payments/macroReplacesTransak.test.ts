import { describe, expect, it } from 'vitest';

/**
 * Which provider collects each fiat lane after retiring Transak.
 *
 * Transak was the fallback for the card, the transfer and the wallet lane in
 * every country nobody else covered. That read as broad coverage while nothing
 * had been verified through it, so a lane could offer itself and fail at the last
 * step — the most expensive moment to discover a gap.
 */
function isMacroCountry(country: string): boolean {
  return country === 'AR';
}

function cardProvider(input: {
  country: string;
  macroConfigured: boolean;
}): { provider: 'macro_click'; configured: boolean } {
  return {
    provider: 'macro_click',
    configured: input.macroConfigured && isMacroCountry(input.country)
  };
}

function wireProvider(input: {
  country: string;
  macroConfigured: boolean;
  bridgeCountry: boolean;
  bridgeConfigured: boolean;
}): { provider: 'bridge' | 'macro_click'; configured: boolean } {
  const useBridge = input.bridgeCountry && input.bridgeConfigured;
  if (useBridge) {
    return { provider: 'bridge', configured: true };
  }
  return {
    provider: 'macro_click',
    configured: input.macroConfigured && isMacroCountry(input.country)
  };
}

describe('tarjeta y transferencia después de retirar Transak', () => {
  it('en Argentina la tarjeta la cobra Macro', () => {
    expect(cardProvider({ country: 'AR', macroConfigured: true })).toEqual({
      provider: 'macro_click',
      configured: true
    });
  });

  it('sin Macro configurado, la tarjeta no se ofrece', () => {
    expect(cardProvider({ country: 'AR', macroConfigured: false }).configured).toBe(false);
  });

  it('fuera de Argentina la tarjeta se declara no disponible en vez de fallar al final', () => {
    expect(cardProvider({ country: 'MX', macroConfigured: true }).configured).toBe(false);
    expect(cardProvider({ country: 'US', macroConfigured: true }).configured).toBe(false);
  });

  it('la transferencia usa Bridge donde llega', () => {
    expect(
      wireProvider({
        country: 'US',
        macroConfigured: true,
        bridgeCountry: true,
        bridgeConfigured: true
      })
    ).toEqual({ provider: 'bridge', configured: true });
  });

  it('en Argentina la transferencia cae en Macro, no en Bridge', () => {
    expect(
      wireProvider({
        country: 'AR',
        macroConfigured: true,
        bridgeCountry: false,
        bridgeConfigured: true
      })
    ).toEqual({ provider: 'macro_click', configured: true });
  });

  it('en un país de Bridge sin credenciales, no se ofrece nada', () => {
    expect(
      wireProvider({
        country: 'DE',
        macroConfigured: true,
        bridgeCountry: true,
        bridgeConfigured: false
      }).configured
    ).toBe(false);
  });
});
