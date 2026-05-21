import { NextResponse } from 'next/server';
import { sendContactEmail } from '../../../lib/contact/sendContactEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: unknown;
      email?: unknown;
      message?: unknown;
    };

    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    const message = String(body.message ?? '').trim();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    if (!EMAIL_RE.test(email) || name.length > 200 || message.length > 5000) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    const sent = await sendContactEmail(name, email, message);

    if (!sent) {
      return NextResponse.json({ error: 'send_failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
