import { isProductionRuntime } from '../runtime/environment';

/** Fail-closed in production: CRON_SECRET must be set and match Authorization bearer. */
export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return !isProductionRuntime();
  }

  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}
