import { NextResponse } from 'next/server';
import { getInvestorOutreach } from '../../../../../../lib/admin/investorOutreachService';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await context.params;
  const outreach = await getInvestorOutreach(userId.trim());

  if (!outreach) {
    return NextResponse.json({ error: 'INVESTOR_NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ outreach });
}
