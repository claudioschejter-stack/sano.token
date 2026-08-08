/**
 * The USD to ARS rate used to charge a local payment.
 *
 * Each rail used to read its own env var and fall back to another rail's, which
 * meant the peso amount a buyer saw depended on which provider happened to
 * serve them. With one resolver they all charge the same, and there is one
 * place to fix when the rate becomes live instead of configured.
 *
 * Provider-specific names still win when set, so a rail can be tuned for its
 * own spread, and the legacy names keep working so nothing changes price the
 * day they are removed from the environment.
 */

const DEFAULT_ARS_PER_USD = 1050;

const CANONICAL = 'FX_ARS';
/**
 * `RIPIO_FX_ARS` stays because Ripio is live — dropping it would silently change
 * the peso amount for anyone whose environment only has that one set, which is
 * the kind of change that shows up as a wrong charge rather than as an error.
 */
const LEGACY = ['RIPIO_FX_ARS'];

function parse(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * @param providerKey Env var for a rail that needs its own rate, tried first.
 */
export function resolveArsPerUsd(providerKey?: string): number {
  const candidates = [
    providerKey ? process.env[providerKey] : undefined,
    process.env[CANONICAL],
    ...LEGACY.map((key) => process.env[key])
  ];

  for (const candidate of candidates) {
    const parsed = parse(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return DEFAULT_ARS_PER_USD;
}

/** True when the rate is a hardcoded default rather than a configured one. */
export function isArsFxRateConfigured(providerKey?: string): boolean {
  return [providerKey, CANONICAL, ...LEGACY].some((key) =>
    key ? parse(process.env[key]) !== null : false
  );
}
