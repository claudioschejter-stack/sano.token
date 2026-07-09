import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';

export const dynamic = 'force-dynamic';

/**
 * Lightweight beacon so client-only failures (e.g. Privy SDK errors that
 * never reach a backend route) show up in our server logs instead of only
 * the user's browser console. No Sentry/client telemetry is wired up yet,
 * so this is the only way we can see what's actually failing remotely.
 */
export async function POST(request: Request) {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    context?: string;
    message?: string;
    stack?: string;
  } | null;

  console.error('[client-error]', {
    userId: ctx.userId,
    context: body?.context?.slice(0, 100) ?? 'unknown',
    message: body?.message?.slice(0, 500) ?? 'unknown',
    stack: body?.stack?.slice(0, 1500)
  });

  return NextResponse.json({ ok: true });
}
