import { NextResponse } from 'next/server';
import { resetPasswordWithToken } from '../../../../lib/auth/passwordResetService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; password?: string };

    if (!body.token?.trim()) {
      return NextResponse.json({ error: 'INVALID_OR_EXPIRED_TOKEN' }, { status: 400 });
    }

    await resetPasswordWithToken(body.token, body.password ?? '');

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'WEAK_PASSWORD' || message === 'INVALID_OR_EXPIRED_TOKEN') {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (message === 'AUTH_SECRET_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 });
    }

    console.error('[auth/reset-password]', error);
    return NextResponse.json({ error: 'RESET_FAILED' }, { status: 500 });
  }
}
