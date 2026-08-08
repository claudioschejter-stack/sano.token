import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { recordAdminAuditLog } from '../../../../lib/admin/assetsService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Investments that no chain can confirm.
 *
 * A demo script wrote one investment per project covering the whole supply, with
 * `txHash` values like `seed-claudio-proj-anelo-services`. They are invisible to
 * every reconciliation the platform has: the share audit starts from payment
 * intents and these have none, and the supply check only compares `Project`
 * against itself. So they sit there looking like sales, marking assets sold out
 * and inflating the portfolio — and since the credit line is a percentage of the
 * portfolio, offering credit against collateral that exists nowhere.
 *
 * A real purchase always carries a 32 byte transaction hash. Anything else in
 * that field never happened on chain.
 */
const ONCHAIN_TX = /^0x[0-9a-fA-F]{64}$/;

type Row = {
  investmentId: string;
  projectId: string;
  projectTitle: string;
  tokenSymbol: string | null;
  email: string | null;
  tokenCount: number;
  purchasePriceUsd: string;
  txHash: string | null;
  purchasedAt: string;
  availableTokensNow: number;
  availableTokensAfterReversal: number;
};

async function findUnbackedInvestments(): Promise<Row[]> {
  const investments = await prisma.investment.findMany({
    include: {
      project: {
        select: { id: true, title: true, tokenSymbol: true, totalTokens: true, availableTokens: true }
      },
      investor: { select: { id: true } }
    },
    orderBy: { purchasePriceUsd: 'desc' }
  });

  const emails = new Map<string, string>();
  const users = await prisma.user.findMany({
    where: { investorId: { not: null } },
    select: { email: true, investorId: true }
  });
  for (const user of users) {
    if (user.investorId) emails.set(user.investorId, user.email);
  }

  return investments
    .filter((row) => !row.txHash || !ONCHAIN_TX.test(row.txHash))
    .map((row) => {
      const restored = Math.min(
        row.project.totalTokens,
        row.project.availableTokens + row.tokenCount
      );
      return {
        investmentId: row.id,
        projectId: row.projectId,
        projectTitle: row.project.title,
        tokenSymbol: row.project.tokenSymbol,
        email: row.investorId ? emails.get(row.investorId) ?? null : null,
        tokenCount: row.tokenCount,
        purchasePriceUsd: row.purchasePriceUsd.toString(),
        txHash: row.txHash,
        purchasedAt: row.purchasedAt.toISOString(),
        availableTokensNow: row.project.availableTokens,
        availableTokensAfterReversal: restored
      };
    });
}

/** Admin: what is booked as sold without a transaction behind it. */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await findUnbackedInvestments();
  const totalUsd = rows.reduce((sum, row) => sum + Number(row.purchasePriceUsd), 0);

  return NextResponse.json({
    ok: true,
    count: rows.length,
    totalTokens: rows.reduce((sum, row) => sum + row.tokenCount, 0),
    totalUsd: totalUsd.toFixed(2),
    /**
     * The number that matters most: the credit line is a share of the portfolio,
     * so this is how much of it stands on nothing.
     */
    note:
      rows.length === 0
        ? 'Todas las inversiones tienen un hash de transacción real.'
        : 'Estas inversiones no tienen transacción on-chain. Marcan activos como vendidos e infuran la cartera y la línea de crédito. Repetí con POST { confirm: true } para revertirlas.',
    rows
  });
}

/**
 * Admin: reverse them.
 *
 * `{ confirm: true }` is required, and the investment is marked `LIQUIDATED`
 * rather than deleted: the row is the only record that the supply was ever
 * booked, and a reversal that leaves no trace is how the next person concludes
 * the numbers were always like this.
 */
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { confirm?: boolean };
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: 'CONFIRM_REQUIRED', detail: 'Mandá { "confirm": true } para revertir.' },
      { status: 400 }
    );
  }

  const rows = await findUnbackedInvestments();
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, reversed: 0, detail: 'No había nada que revertir.' });
  }

  const reversed: string[] = [];
  for (const row of rows) {
    try {
      await prisma.$transaction([
        prisma.investment.update({
          where: { id: row.investmentId },
          data: { status: 'LIQUIDATED' }
        }),
        prisma.project.update({
          where: { id: row.projectId },
          // Capped by the database check constraint anyway; capped here too so a
          // double run cannot push availability past the total.
          data: { availableTokens: row.availableTokensAfterReversal }
        })
      ]);
      reversed.push(row.investmentId);
    } catch (error) {
      console.error('[admin/seeded-investments] reversal failed', row.investmentId, error);
    }
  }

  await recordAdminAuditLog({
    actorUserId: (session as { user?: { id?: string } }).user?.id ?? null,
    action: 'SEEDED_INVESTMENTS_REVERSED',
    metadata: { investmentIds: reversed, count: reversed.length }
  });

  return NextResponse.json({
    ok: true,
    reversed: reversed.length,
    attempted: rows.length,
    detail:
      'Las inversiones quedaron en LIQUIDATED y el cupo volvió a estar disponible. Nada se borró: el registro de que estuvo reservado se conserva.'
  });
}
