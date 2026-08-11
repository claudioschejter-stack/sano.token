/**
 * Cuántos pesos hay que cobrar para que a la treasury entren los USDC de la compra.
 *
 * El cobro en pesos se calculaba con `USD × MACRO_CLICK_FX_ARS`, un valor fijo con
 * default 1050. Si el peso se devaluó desde la última vez que alguien tocó esa
 * variable, se cobra de menos: el inversor paga, Ripio convierte a la cotización
 * real, y a la treasury entran menos USDC que los tokens que ya se entregaron. La
 * diferencia la absorbe Sanova, en silencio y en cada compra.
 *
 * La cotización correcta no es una referencia de dólar cualquiera: es la de Ripio,
 * porque Ripio es quien convierte esos pesos. Y no alcanza con su tipo de cambio
 * nominal, porque cobra comisión: lo que importa es `finalToAmount`, el USDC que
 * queda después de sus costos. Con una cotización de prueba se despeja cuántos
 * pesos hacen falta para el objetivo.
 *
 * Sobre eso va un margen, porque entre cotizar y convertir pasa tiempo. Quedarse
 * corto significa entregar tokens que no se pagaron; pasarse significa cobrar unos
 * pesos de más, que se pueden devolver. La asimetría manda.
 */

/** Margen sobre el monto despejado, para el movimiento de la cotización. */
export const DEFAULT_ARS_QUOTE_MARGIN_PERCENT = 1.5;

export function arsQuoteMarginPercent(): number {
  const raw = process.env.ARS_QUOTE_MARGIN_PERCENT?.trim();
  if (!raw) return DEFAULT_ARS_QUOTE_MARGIN_PERCENT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 20) {
    return DEFAULT_ARS_QUOTE_MARGIN_PERCENT;
  }
  return parsed;
}

export type RipioProbeQuote = {
  /** Pesos con los que se pidió la cotización. */
  fromAmountArs: number;
  /** USDC que quedarían tras las comisiones de Ripio. Es el número que decide. */
  finalToAmountUsdc: number;
};

export type ArsChargeDecision = {
  /** Pesos a cobrar por Macro. */
  arsToCharge: number;
  /** Pesos por USDC que se desprenden de la cotización, comisiones incluidas. */
  effectiveArsPerUsdc: number | null;
  /** `quote` cuando salió de Ripio, `static` cuando se cayó a la variable fija. */
  source: 'quote' | 'static';
  marginPercent: number;
  /**
   * Por qué no se pudo usar la cotización. Cuando viene con valor, el monto es una
   * estimación y la diferencia la puede absorber la treasury, así que conviene
   * que quede escrito en la metadata del pago y no sólo en un log.
   */
  fallbackReason?: 'NO_QUOTE' | 'QUOTE_UNUSABLE';
};

function roundArs(value: number): number {
  // Dos decimales: es lo que acepta el campo de monto de Macro.
  return Math.ceil(value * 100) / 100;
}

/**
 * @param targetUsdc USDC que tienen que entrar a la treasury, gastos incluidos.
 * @param quote Cotización de prueba de Ripio, o `null` si no se pudo obtener.
 * @param staticArsPerUsd Fallback configurado, para no quedarse sin cobrar.
 */
export function arsChargeForTargetUsdc(input: {
  targetUsdc: number;
  quote?: RipioProbeQuote | null;
  staticArsPerUsd: number;
  marginPercent?: number;
}): ArsChargeDecision {
  const margin = input.marginPercent ?? arsQuoteMarginPercent();
  const marginFactor = 1 + margin / 100;

  if (!Number.isFinite(input.targetUsdc) || input.targetUsdc <= 0) {
    return {
      arsToCharge: 0,
      effectiveArsPerUsdc: null,
      source: 'static',
      marginPercent: margin,
      fallbackReason: 'QUOTE_UNUSABLE'
    };
  }

  const quote = input.quote;
  const usable =
    quote &&
    Number.isFinite(quote.fromAmountArs) &&
    quote.fromAmountArs > 0 &&
    Number.isFinite(quote.finalToAmountUsdc) &&
    quote.finalToAmountUsdc > 0;

  if (!usable) {
    return {
      arsToCharge: roundArs(input.targetUsdc * input.staticArsPerUsd * marginFactor),
      effectiveArsPerUsdc: null,
      source: 'static',
      marginPercent: margin,
      fallbackReason: quote ? 'QUOTE_UNUSABLE' : 'NO_QUOTE'
    };
  }

  /**
   * Regla de tres sobre la cotización de prueba. Se usa `finalToAmount` y no
   * `toAmount` porque la comisión de Ripio sale del medio: cobrar contra el bruto
   * deja la diferencia sin cubrir.
   */
  const effectiveArsPerUsdc = quote.fromAmountArs / quote.finalToAmountUsdc;

  return {
    arsToCharge: roundArs(input.targetUsdc * effectiveArsPerUsdc * marginFactor),
    effectiveArsPerUsdc,
    source: 'quote',
    marginPercent: margin
  };
}

/**
 * Si lo que efectivamente entró alcanza para lo que se prometió.
 *
 * Se llama cuando el on-ramp liquida, con el USDC realmente acreditado. Un faltante
 * no debería frenar la entrega —el inversor pagó lo que se le pidió— pero sí tiene
 * que quedar registrado, porque es plata que puso Sanova y hoy no se veía en
 * ninguna parte.
 */
export function usdcShortfall(input: {
  targetUsdc: number;
  receivedUsdc: number;
}): { shortfallUsdc: number; covered: boolean } {
  if (!Number.isFinite(input.receivedUsdc) || !Number.isFinite(input.targetUsdc)) {
    return { shortfallUsdc: 0, covered: false };
  }
  // Un centavo de USDC de tolerancia, igual que la búsqueda de la transferencia.
  const diff = input.targetUsdc - input.receivedUsdc;
  if (diff <= 0.01) {
    return { shortfallUsdc: 0, covered: true };
  }
  return { shortfallUsdc: Math.round(diff * 1e6) / 1e6, covered: false };
}
