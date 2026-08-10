import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ARS_QUOTE_MARGIN_PERCENT,
  arsChargeForTargetUsdc,
  arsQuoteMarginPercent,
  usdcShortfall
} from './arsChargeForTargetUsdc';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('arsChargeForTargetUsdc', () => {
  /**
   * El caso que motiva todo: 20 USDC con la variable fija en 1050 se cobraban
   * 21.000 pesos. Si Ripio convierte a 1400 efectivos, esos pesos son 15 USDC y
   * a la treasury le faltan 5 por cada compra.
   */
  it('cobra según la cotización real y no según la variable fija', () => {
    const decision = arsChargeForTargetUsdc({
      targetUsdc: 20,
      quote: { fromAmountArs: 14_000, finalToAmountUsdc: 10 },
      staticArsPerUsd: 1050,
      marginPercent: 0
    });

    expect(decision.effectiveArsPerUsdc).toBe(1400);
    expect(decision.arsToCharge).toBe(28_000);
    expect(decision.source).toBe('quote');
  });

  it('usa finalToAmount y no el bruto, así la comisión de Ripio queda cubierta', () => {
    // 14.000 ARS entran, 10 USDC brutos, 9,5 netos tras comisión.
    const decision = arsChargeForTargetUsdc({
      targetUsdc: 20,
      quote: { fromAmountArs: 14_000, finalToAmountUsdc: 9.5 },
      staticArsPerUsd: 1050,
      marginPercent: 0
    });

    // 14.000 / 9,5 = 1473,68 por USDC → 29.473,69 por 20.
    expect(decision.arsToCharge).toBeGreaterThan(28_000);
    expect(decision.arsToCharge).toBe(29_473.69);
  });

  it('suma el margen por el movimiento entre cotizar y convertir', () => {
    const decision = arsChargeForTargetUsdc({
      targetUsdc: 20,
      quote: { fromAmountArs: 14_000, finalToAmountUsdc: 10 },
      staticArsPerUsd: 1050,
      marginPercent: 1.5
    });

    expect(decision.arsToCharge).toBe(28_420);
    expect(decision.marginPercent).toBe(1.5);
  });

  it('redondea para arriba, porque quedarse corto es entregar tokens sin pagar', () => {
    const decision = arsChargeForTargetUsdc({
      targetUsdc: 3,
      quote: { fromAmountArs: 1000, finalToAmountUsdc: 3 },
      staticArsPerUsd: 1050,
      marginPercent: 0
    });

    // 1000/3 = 333,333… por USDC; por 3 USDC da 999,999… y se cobra 1000.
    expect(decision.arsToCharge).toBe(1000);
  });

  describe('cuando no hay cotización', () => {
    it('cae a la variable fija y lo deja marcado', () => {
      const decision = arsChargeForTargetUsdc({
        targetUsdc: 20,
        quote: null,
        staticArsPerUsd: 1050,
        marginPercent: 0
      });

      expect(decision.arsToCharge).toBe(21_000);
      expect(decision.source).toBe('static');
      expect(decision.fallbackReason).toBe('NO_QUOTE');
      expect(decision.effectiveArsPerUsdc).toBeNull();
    });

    it('trata una cotización con ceros como inservible', () => {
      const decision = arsChargeForTargetUsdc({
        targetUsdc: 20,
        quote: { fromAmountArs: 14_000, finalToAmountUsdc: 0 },
        staticArsPerUsd: 1050
      });

      expect(decision.source).toBe('static');
      expect(decision.fallbackReason).toBe('QUOTE_UNUSABLE');
    });
  });

  it('no cobra nada si el objetivo no es un número válido', () => {
    expect(arsChargeForTargetUsdc({ targetUsdc: 0, staticArsPerUsd: 1050 }).arsToCharge).toBe(0);
    expect(arsChargeForTargetUsdc({ targetUsdc: Number.NaN, staticArsPerUsd: 1050 }).arsToCharge).toBe(0);
  });
});

describe('arsQuoteMarginPercent', () => {
  it('usa el default cuando no está configurado', () => {
    delete process.env.ARS_QUOTE_MARGIN_PERCENT;
    expect(arsQuoteMarginPercent()).toBe(DEFAULT_ARS_QUOTE_MARGIN_PERCENT);
  });

  it('respeta un margen configurado', () => {
    process.env.ARS_QUOTE_MARGIN_PERCENT = '3';
    expect(arsQuoteMarginPercent()).toBe(3);
  });

  it('ignora un margen absurdo en vez de cobrar de más', () => {
    process.env.ARS_QUOTE_MARGIN_PERCENT = '80';
    expect(arsQuoteMarginPercent()).toBe(DEFAULT_ARS_QUOTE_MARGIN_PERCENT);
    process.env.ARS_QUOTE_MARGIN_PERCENT = '-5';
    expect(arsQuoteMarginPercent()).toBe(DEFAULT_ARS_QUOTE_MARGIN_PERCENT);
  });
});

describe('usdcShortfall', () => {
  it('no reporta faltante cuando entró lo prometido', () => {
    expect(usdcShortfall({ targetUsdc: 20, receivedUsdc: 20 })).toEqual({
      shortfallUsdc: 0,
      covered: true
    });
  });

  it('tolera un centavo de redondeo', () => {
    expect(usdcShortfall({ targetUsdc: 20, receivedUsdc: 19.995 }).covered).toBe(true);
  });

  it('reporta el faltante que puso Sanova', () => {
    expect(usdcShortfall({ targetUsdc: 20, receivedUsdc: 15 })).toEqual({
      shortfallUsdc: 5,
      covered: false
    });
  });

  it('no se queja cuando entró de más', () => {
    expect(usdcShortfall({ targetUsdc: 20, receivedUsdc: 21 }).covered).toBe(true);
  });
});
