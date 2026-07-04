import { isProductionRuntime } from '../runtime/environment';

/**
 * Fail-closed in production: CRON_SECRET must be set and match Authorization bearer.
 * Also accepts CRON_EXTERNAL_SECRET, used by external schedulers (e.g. a GitHub Actions
 * workflow) that ping routes more often than the Hobby-plan Vercel Cron limit (once/day)
 * allows.
 */
export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const externalSecret = process.env.CRON_EXTERNAL_SECRET?.trim();
  if (!secret && !externalSecret) {
    return !isProductionRuntime();
  }

  const header = request.headers.get('authorization');
  if (secret && header === `Bearer ${secret}`) {
    return true;
  }
  return Boolean(externalSecret) && header === `Bearer ${externalSecret}`;
}
