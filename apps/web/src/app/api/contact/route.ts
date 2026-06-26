import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { sendContactEmail } from '../../../lib/contact/sendContactEmail';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Waitlist handler ──────────────────────────────────────────────────────────

async function handleWaitlist(email: string, projectId: string) {
  // Upsert — deduplicates silently if already registered
  const entry = await prisma.waitlistEntry.upsert({
    where: { email_projectId: { email, projectId } },
    create: { email, projectId },
    update: {}
  });

  // Send notification email (non-blocking — don't fail the request if email fails)
  const subject = `[Waitlist] Interés en propiedad ${projectId}`;
  const message = `Email: ${email}\nPropiedad ID: ${projectId}\n\nSe registró en la lista de espera.`;
  void sendContactEmail('Waitlist Bot', email, message, {
    subject,
    replyTo: email
  });

  return { ok: true, alreadyRegistered: entry.createdAt < new Date(Date.now() - 1000) };
}

// ── Contact handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: unknown;
      email?: unknown;
      message?: unknown;
      type?: unknown;
      propertyId?: unknown;
    };

    const type = String(body.type ?? '').trim();
    const email = String(body.email ?? '').trim();

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }

    // ── Waitlist path ──
    if (type === 'waitlist') {
      const projectId = String(body.propertyId ?? '').trim();
      if (!projectId) {
        return NextResponse.json({ error: 'missing_property_id' }, { status: 400 });
      }
      const result = await handleWaitlist(email, projectId);
      return NextResponse.json(result);
    }

    // ── Regular contact path ──
    const name = String(body.name ?? '').trim();
    const message = String(body.message ?? '').trim();

    if (!name || !message) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    if (name.length > 200 || message.length > 5000) {
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
