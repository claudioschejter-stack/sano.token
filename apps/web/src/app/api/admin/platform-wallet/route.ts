import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getPlatformWalletConfig } from '../../../../lib/admin/platformWalletConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();

  if (!session?.user?.accessToken || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  return NextResponse.json({ config: getPlatformWalletConfig() });
}
