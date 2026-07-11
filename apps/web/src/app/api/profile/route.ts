import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAuthenticatedSession } from '../../../lib/onboarding/requireAuthenticatedSession';
import { resolveStoredMediaPathToPublicUrl } from '../../../lib/storage/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireAuthenticatedSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { name: true, image: true, kycPortraitPath: true }
  });

  // `image` should normally already be set by persistDiditMedia at KYC
  // approval time, but fall back to resolving kycPortraitPath in case the
  // avatar was uploaded before storage was fully configured, or before this
  // field existed — this way a re-approval isn't required to backfill it.
  const image = user?.image ?? (user?.kycPortraitPath ? resolveStoredMediaPathToPublicUrl(user.kycPortraitPath) : null);

  return NextResponse.json({ name: user?.name ?? null, image });
}
