import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../../../lib/admin/requireAdmin';
import { createYieldBatchFromOperatingBalance } from '../../../../../../../lib/yield/projectOperatingService';
import { chooseYieldConversionRail } from '../../../../../../../lib/yield/yieldConversionRouter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/** Batch fiat operating balance → USDC conversion job (cheapest rail by currency). */
export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    currency?: string;
    amount?: number;
  };

  const currency = body.currency ?? 'USD';
  const quote = chooseYieldConversionRail(currency);

  try {
    const batch = await createYieldBatchFromOperatingBalance({
      projectId,
      currency,
      amount: body.amount
    });

    return NextResponse.json({
      ok: true,
      quote,
      batch: {
        id: batch.id,
        status: batch.status,
        sourceCurrency: batch.sourceCurrency,
        sourceAmount: batch.sourceAmount.toString(),
        conversionRail: batch.conversionRail,
        vaultAddress: batch.vaultAddress,
        chainId: batch.chainId
      }
    });
  } catch (error) {
    console.error('[admin/operating/convert]', error);
    const message = error instanceof Error ? error.message : 'Conversion batch failed';
    return NextResponse.json({ error: message, quote }, { status: 400 });
  }
}
