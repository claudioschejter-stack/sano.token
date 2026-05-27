import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { getPaymentsProductionSummary } from '../../../../../lib/payments/paymentsIntegrationStatus';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://sano-token-web.vercel.app');

  return NextResponse.json(getPaymentsProductionSummary(siteUrl));
}
