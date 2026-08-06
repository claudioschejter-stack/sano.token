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

/**
 * Same authorization, plus a signed-in admin.
 *
 * These routes are the platform's maintenance controls, and an operator with an
 * admin session is more privileged than whoever holds the cron secret. Without
 * this, running one by hand means digging the secret out of Vercel and pasting
 * it into a fetch, which is both friction and a good way to leak it.
 */
export async function isCronRequestAllowed(request: Request): Promise<boolean> {
  if (isCronRequestAuthorized(request)) {
    return true;
  }
  const { requireAdminSession } = await import('../admin/requireAdmin');
  return Boolean(await requireAdminSession().catch(() => null));
}
