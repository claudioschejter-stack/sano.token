import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { getAdminAsset } from '../../../../lib/admin/assetsService';
import { migrateTreasuryVaultSharesToWallet } from '../../../../lib/blockchain/migrateTreasuryVaultShares';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { projectId?: string; recipientWallet?: string; tokenCount?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  if (!projectId) {
    return NextResponse.json({ error: 'MISSING_PROJECT_ID' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { walletAddress: true, investorId: true }
  });

  const recipientWallet = body.recipientWallet?.trim() || user?.walletAddress?.trim() || null;
  if (!recipientWallet) {
    return NextResponse.json(
      { error: 'MISSING_RECIPIENT_WALLET', detail: 'Vinculá tu wallet Coinbase en el dashboard.' },
      { status: 422 }
    );
  }

  const asset = await getAdminAsset(projectId);
  if (!asset?.vaultAddress || !asset.contractAddress) {
    return NextResponse.json({ error: 'VAULT_NOT_DEPLOYED' }, { status: 422 });
  }

  let shareAmount: bigint | undefined;
  if (body.tokenCount && body.tokenCount > 0 && user?.investorId) {
    const investment = await prisma.investment.findFirst({
      where: {
        investorId: user.investorId,
        projectId,
        status: 'ACTIVE'
      },
      select: { tokenCount: true }
    });

    const tokensToMove = Math.min(body.tokenCount, investment?.tokenCount ?? body.tokenCount);
    shareAmount = BigInt(tokensToMove) * 10n ** 18n;
  }

  const result = await migrateTreasuryVaultSharesToWallet({
    asset,
    recipientWallet,
    shareAmount
  });

  if (result.ok === false) {
    return NextResponse.json({ error: result.code, detail: result.detail }, { status: 422 });
  }

  if (user?.investorId) {
    await prisma.investor.update({
      where: { id: user.investorId },
      data: { walletAddress: recipientWallet.toLowerCase() }
    });
    await prisma.user.update({
      where: { id: session.user.id },
      data: { walletAddress: recipientWallet.toLowerCase() }
    });
  }

  return NextResponse.json({
    ok: true,
    txHash: result.txHash,
    sharesTransferred: result.sharesTransferred,
    recipient: result.recipient,
    treasury: result.treasury
  });
}
