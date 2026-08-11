import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PROBE_ARS_AMOUNT,
  resetArsQuoteCache,
  resolveArsChargeForUsdc
} from './effectiveArsRate';

const originalEnv = { ...process.env };

beforeEach(() => {
  resetArsQuoteCache();
  process.env.MACRO_CLICK_FX_ARS = '1050';
});

afterEach(() => {
  process.env = { ...originalEnv };
  resetArsQuoteCache();
});

const quoteOf = (arsPerUsdc: number) => ({
  fromAmountArs: PROBE_ARS_AMOUNT,
  finalToAmountUsdc: PROBE_ARS_AMOUNT / arsPerUsdc
});

describe('resolveArsChargeForUsdc', () => {
  it('cobra según la cotización de Ripio', async () => {
    const fetchQuote = vi.fn(async () => quoteOf(1400));

    const decision = await resolveArsChargeForUsdc({
      targetUsdc: 20,
      fetchQuote,
      providerFxKey: 'MACRO_CLICK_FX_ARS'
    });

    expect(decision.source).toBe('quote');
    expect(decision.effectiveArsPerUsdc).toBeCloseTo(1400, 6);
    // 20 × 1400 × 1,015 de margen por default.
    expect(decision.arsToCharge).toBeCloseTo(28_420, 2);
    expect(fetchQuote).toHaveBeenCalledWith(PROBE_ARS_AMOUNT);
  });

  it('cae a la variable fija cuando la cotización falla, y lo marca', async () => {
    const fetchQuote = vi.fn(async () => {
      throw new Error('ripio 500');
    });

    const decision = await resolveArsChargeForUsdc({
      targetUsdc: 20,
      fetchQuote,
      providerFxKey: 'MACRO_CLICK_FX_ARS'
    });

    expect(decision.source).toBe('static');
    expect(decision.fallbackReason).toBe('NO_QUOTE');
    // El comportamiento de hoy: 20 × 1050, más el margen.
    expect(decision.arsToCharge).toBeCloseTo(21_315, 2);
  });

  it('cachea la cotización en vez de pedirla en cada checkout', async () => {
    const fetchQuote = vi.fn(async () => quoteOf(1400));

    await resolveArsChargeForUsdc({ targetUsdc: 20, fetchQuote });
    await resolveArsChargeForUsdc({ targetUsdc: 40, fetchQuote });

    expect(fetchQuote).toHaveBeenCalledTimes(1);
  });

  it('vuelve a cotizar cuando la caché venció', async () => {
    const fetchQuote = vi.fn(async () => quoteOf(1400));
    process.env.ARS_QUOTE_CACHE_TTL_MS = '1000';

    const t0 = Date.parse('2026-08-10T12:00:00Z');
    await resolveArsChargeForUsdc({ targetUsdc: 20, fetchQuote, nowMs: t0 });
    await resolveArsChargeForUsdc({ targetUsdc: 20, fetchQuote, nowMs: t0 + 2000 });

    expect(fetchQuote).toHaveBeenCalledTimes(2);
  });

  /** Diez checkouts a la vez no deberían pedir diez cotizaciones. */
  it('comparte una sola llamada entre pedidos simultáneos', async () => {
    let resolveQuote: (value: ReturnType<typeof quoteOf>) => void = () => {};
    const fetchQuote = vi.fn(
      () =>
        new Promise<ReturnType<typeof quoteOf>>((resolve) => {
          resolveQuote = resolve;
        })
    );

    const pending = Promise.all([
      resolveArsChargeForUsdc({ targetUsdc: 20, fetchQuote }),
      resolveArsChargeForUsdc({ targetUsdc: 20, fetchQuote }),
      resolveArsChargeForUsdc({ targetUsdc: 20, fetchQuote })
    ]);

    resolveQuote(quoteOf(1400));
    const decisions = await pending;

    expect(fetchQuote).toHaveBeenCalledTimes(1);
    expect(decisions.every((d) => d.source === 'quote')).toBe(true);
  });

  it('el monto escala con los USDC pedidos, aunque la cotización sea la misma', async () => {
    const fetchQuote = vi.fn(async () => quoteOf(1400));

    const veinte = await resolveArsChargeForUsdc({ targetUsdc: 20, fetchQuote });
    const cuarenta = await resolveArsChargeForUsdc({ targetUsdc: 40, fetchQuote });

    expect(cuarenta.arsToCharge).toBeCloseTo(veinte.arsToCharge * 2, 1);
  });
});
