import { NextResponse } from 'next/server';
import { resolveLaunchIssuerWallet } from '../../../../lib/admin/resolveLaunchIssuerWallet';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const walletAddress = await resolveLaunchIssuerWallet(session.user?.id ?? null);

  return NextResponse.json({
    walletAddress,
    linked: Boolean(walletAddress),
    source: walletAddress ? (session.user?.id ? 'profile' : 'env') : null
  });
}
