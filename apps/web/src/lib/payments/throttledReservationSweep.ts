import { expireStaleCartReservations } from './closeStaleCartBatches';

/**
 * Vercel Hobby only allows daily cron jobs, so expired reservations are also
 * swept opportunistically whenever someone starts a checkout. Throttled per
 * server instance to keep it off the critical path.
 */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let lastSweepAt = 0;
let inFlight: Promise<unknown> | null = null;

export function reservationSweepIntervalMs(): number {
  return SWEEP_INTERVAL_MS;
}

/** Fire-and-forget: never blocks or fails the caller. */
export function runThrottledReservationSweep(now = Date.now()): void {
  if (inFlight) return;
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;

  lastSweepAt = now;
  inFlight = expireStaleCartReservations(100)
    .then((result) => {
      if (result.releasedTokens > 0) {
        console.info('[reservationSweep] released tokens', result.releasedTokens);
      }
    })
    .catch((error) => {
      console.error('[reservationSweep] failed', error);
    })
    .finally(() => {
      inFlight = null;
    });
}

/** Test hook: reset the throttle window. */
export function resetReservationSweepThrottle(): void {
  lastSweepAt = 0;
  inFlight = null;
}
