/** GA4 measurement ID (e.g. G-XXXXXXXXXX). Leave empty to disable. */
export function getGaMeasurementId(): string {
  return (
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GA_ID?.trim() ||
    ''
  );
}

/** Plausible site domain (e.g. sanovacapital.com). Leave empty to disable. */
export function getPlausibleDomain(): string {
  return process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() || '';
}

/** Optional Plausible script host (default: plausible.io). */
export function getPlausibleScriptSrc(): string {
  const custom = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim();
  if (custom) {
    return custom;
  }
  return 'https://plausible.io/js/script.js';
}

export function isGaEnabled(): boolean {
  return getGaMeasurementId().length > 0;
}

export function isPlausibleEnabled(): boolean {
  return getPlausibleDomain().length > 0;
}

export function isAnalyticsEnabled(): boolean {
  return isGaEnabled() || isPlausibleEnabled();
}
