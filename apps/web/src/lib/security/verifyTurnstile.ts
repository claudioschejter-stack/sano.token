type TurnstileVerifyResponse = {
  success: boolean;
  'error-codes'?: string[];
};

/**
 * Verifies a Cloudflare Turnstile token server-side.
 * Returns true if valid, false if missing secret key (non-blocking in dev) or invalid token.
 */
export async function verifyTurnstile(token: string | undefined | null): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();

  // If no secret key is configured (e.g. local dev without Turnstile), allow through.
  if (!secretKey) {
    console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — skipping verification');
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token }).toString()
    });

    const data = (await response.json()) as TurnstileVerifyResponse;
    return data.success === true;
  } catch (error) {
    console.error('[turnstile] Verification request failed', error);
    return false;
  }
}
