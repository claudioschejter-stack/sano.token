import { arsChargeForTargetUsdc, type ArsChargeDecision, type RipioProbeQuote } from './arsChargeForTargetUsdc';
import { resolveArsPerUsd } from './arsFxRate';

/**
 * La cotización efectiva de Ripio, cacheada, para no pedirla en cada checkout.
 *
 * Cotizar cuesta una llamada de red en el camino que el inversor está esperando, y
 * el precio no se mueve tanto en un minuto. Se cachea la cotización de prueba, no
 * el monto final: el monto depende de cuántos USDC pida cada compra.
 *
 * Si la cotización falla, se cae a la variable fija y queda anotado en la decisión.
 * Un checkout que no arranca es peor que un monto estimado, pero la estimación
 * tiene que viajar marcada para que después se pueda auditar el faltante.
 */

const DEFAULT_TTL_MS = 3 * 60_000;

export type QuoteFetcher = (probeArs: number) => Promise<RipioProbeQuote | null>;

type CachedQuote = {
  quote: RipioProbeQuote;
  expiresAtMs: number;
};

let cached: CachedQuote | null = null;
/** Para que N checkouts simultáneos compartan una sola llamada. */
let inFlight: Promise<RipioProbeQuote | null> | null = null;

export function quoteCacheTtlMs(): number {
  const raw = process.env.ARS_QUOTE_CACHE_TTL_MS?.trim();
  if (!raw) return DEFAULT_TTL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_TTL_MS;
  return parsed;
}

/** Sólo para tests: la caché es de módulo y sobrevive entre casos. */
export function resetArsQuoteCache(): void {
  cached = null;
  inFlight = null;
}

/**
 * Pesos con los que se pide la cotización de prueba. Un monto realista, porque
 * algunos proveedores dan distinta comisión por tramo y cotizar con 1 peso daría
 * una tasa que no aplica a una compra real.
 */
export const PROBE_ARS_AMOUNT = 50_000;

async function probeQuote(fetchQuote: QuoteFetcher, nowMs: number): Promise<RipioProbeQuote | null> {
  if (cached && cached.expiresAtMs > nowMs) {
    return cached.quote;
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const quote = await fetchQuote(PROBE_ARS_AMOUNT);
      if (quote) {
        cached = { quote, expiresAtMs: nowMs + quoteCacheTtlMs() };
      }
      return quote;
    } catch {
      // Sin cotización se cobra con la variable fija; el llamador lo marca.
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/**
 * Cuántos pesos cobrar para que entren `targetUsdc`, usando la cotización de Ripio
 * cuando se pueda conseguir.
 */
export async function resolveArsChargeForUsdc(input: {
  targetUsdc: number;
  fetchQuote: QuoteFetcher;
  providerFxKey?: string;
  nowMs?: number;
}): Promise<ArsChargeDecision> {
  const now = input.nowMs ?? Date.now();
  const quote = await probeQuote(input.fetchQuote, now);

  return arsChargeForTargetUsdc({
    targetUsdc: input.targetUsdc,
    quote,
    staticArsPerUsd: resolveArsPerUsd(input.providerFxKey)
  });
}
