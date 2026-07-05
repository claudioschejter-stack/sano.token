import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { normalizeEmail } from '../../../../lib/auth/contactValidation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/register/check-email
 * Pre-check during registration to guide users with existing accounts before they submit the full form.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string };
  const email = normalizeEmail(body.email ?? '');

  if (!email) {
    return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true }
  });

  if (user?.passwordHash) {
    return NextResponse.json({ available: false, reason: 'EMAIL_IN_USE' });
  }

  return NextResponse.json({ available: true });
}
