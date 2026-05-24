import { getSupabaseAdmin } from '../storage/supabaseAdmin';

export type SupabaseOtpChannel = 'EMAIL' | 'PHONE';

export type SupabaseOtpResult = {
  ok: boolean;
  error?: string;
};

/**
 * Sends an OTP via Supabase Auth.
 *
 * - Email: requires Auth → Email Templates configured and (optionally) custom SMTP.
 * - Phone: requires Auth → Providers → Phone configured with Twilio (or other).
 *
 * `shouldCreateUser: true` makes the call idempotent: Supabase Auth keeps an
 * `auth.users` shadow record that we do not consume — NextAuth + Prisma User
 * remain the source of truth.
 */
export async function sendSupabaseOtp(
  channel: SupabaseOtpChannel,
  target: string
): Promise<SupabaseOtpResult> {
  const client = getSupabaseAdmin();

  if (!client) {
    return { ok: false, error: 'SUPABASE_NOT_CONFIGURED' };
  }

  try {
    const { error } =
      channel === 'EMAIL'
        ? await client.auth.signInWithOtp({
            email: target,
            options: { shouldCreateUser: true }
          })
        : await client.auth.signInWithOtp({
            phone: target,
            options: { shouldCreateUser: true }
          });

    if (error) {
      console.warn('[supabase-otp] send failed', channel, error.message);
      return { ok: false, error: `SUPABASE_${error.status ?? 'ERROR'}` };
    }

    return { ok: true };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'UNKNOWN';
    console.error('[supabase-otp] send exception', channel, message);
    return { ok: false, error: 'SUPABASE_EXCEPTION' };
  }
}

/** Verifies an OTP previously sent via Supabase. Does not consume the resulting session. */
export async function verifySupabaseOtp(
  channel: SupabaseOtpChannel,
  target: string,
  code: string
): Promise<SupabaseOtpResult> {
  const client = getSupabaseAdmin();

  if (!client) {
    return { ok: false, error: 'SUPABASE_NOT_CONFIGURED' };
  }

  const token = code.trim();

  try {
    const { error } =
      channel === 'EMAIL'
        ? await client.auth.verifyOtp({ email: target, token, type: 'email' })
        : await client.auth.verifyOtp({ phone: target, token, type: 'sms' });

    if (error) {
      console.warn('[supabase-otp] verify failed', channel, error.message);
      return { ok: false, error: 'INVALID_CODE' };
    }

    return { ok: true };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'UNKNOWN';
    console.error('[supabase-otp] verify exception', channel, message);
    return { ok: false, error: 'SUPABASE_EXCEPTION' };
  }
}

export function isSupabaseOtpEnabled(): boolean {
  const provider = process.env.ONBOARDING_OTP_PROVIDER?.trim().toLowerCase();
  return provider === 'supabase';
}
