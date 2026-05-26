import { NextResponse } from 'next/server';
import { getAdminAsset } from '../../../../../../lib/admin/assetsService';
import { getInvestorWallet } from '../../../../../../lib/admin/investorsService';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { setInvestorKycAllowlist } from '../../../../../../lib/blockchain/kycAllowlist';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await context.params;
  const body = (await request.json().catch(() => null)) as { projectId?: string; approved?: boolean } | null;

  if (!body?.projectId || typeof body.approved !== 'boolean') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const [asset, investorWallet] = await Promise.all([
    getAdminAsset(body.projectId),
    getInvestorWallet(userId)
  ]);

  if (!asset?.contractAddress) {
    return NextResponse.json({ error: 'Asset token not deployed' }, { status: 400 });
  }
  if (!investorWallet) {
    return NextResponse.json({ error: 'Investor wallet missing' }, { status: 400 });
  }

  try {
    const result = await setInvestorKycAllowlist({
      tokenAddress: asset.contractAddress,
      walletAddress: investorWallet,
      approved: body.approved
    });
    return NextResponse.json({ result });
  } catch (error) {
    console.error('[admin/investors/allowlist]', error);
    return NextResponse.json({ error: 'Allowlist update failed' }, { status: 500 });
  }
}
