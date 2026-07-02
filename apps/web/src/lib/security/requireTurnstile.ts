import { NextResponse } from 'next/server';
import { verifyTurnstile } from './verifyTurnstile';

/**
 * Validates Cloudflare Turnstile token from request body.
 * Returns null when valid, or a NextResponse error payload.
 */
export async function requireTurnstile(
  turnstileToken: string | undefined | null
): Promise<NextResponse | null> {
  const secretConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
  if (!secretConfigured) {
    return null;
  }

  const valid = await verifyTurnstile(turnstileToken);
  if (!valid) {
    return NextResponse.json({ error: 'CAPTCHA_INVALIDO' }, { status: 400 });
  }

  return null;
}
