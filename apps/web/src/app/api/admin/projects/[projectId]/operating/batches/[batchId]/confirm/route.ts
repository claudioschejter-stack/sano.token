import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../../../../../lib/admin/requireAdmin';
import { completeYieldConversion } from '../../../../../../../../../lib/yield/yieldConversionService';
import { enqueueYieldBatchJobs } from '../../../../../../../../../lib/yield/yieldJobProcessor';
import { prisma } from '@sanova/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ projectId: string; batchId: string }>;
};

/** Admin confirms off-platform ARS→USDC conversion and triggers investor distribution. */
export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId, batchId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    usdcAmount?: number;
    conversionTxHash?: string;
    notes?: string;
  };

  const batch = await prisma.projectYieldBatch.findFirst({
    where: { id: batchId, projectId }
  });

  if (!batch) {
    return NextResponse.json({ error: 'BATCH_NOT_FOUND' }, { status: 404 });
  }

  if (batch.status === 'COMPLETED') {
    return NextResponse.json({ ok: true, batch, action: 'already_completed' });
  }

  const usdcAmount = Number(body.usdcAmount ?? batch.usdcAmount?.toNumber() ?? batch.sourceAmount.toNumber());
  if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) {
    return NextResponse.json({ error: 'INVALID_USDC_AMOUNT' }, { status: 400 });
  }

  try {
    const completed = await completeYieldConversion({
      batchId: batch.id,
      usdcAmount,
      conversionRef: batch.conversionRef,
      conversionTxHash: body.conversionTxHash?.trim() || null,
      provider: 'admin_manual',
      payload: {
        notes: body.notes?.trim() || null,
        confirmedBy: 'admin_ui'
      }
    });

    return NextResponse.json({
      ok: true,
      batch: {
        id: completed.id,
        status: completed.status,
        usdcAmount: completed.usdcAmount?.toString() ?? null,
        conversionTxHash: completed.conversionTxHash
      },
      action: 'completed'
    });
  } catch (error) {
    console.error('[admin/operating/batches/confirm]', error);
    const message = error instanceof Error ? error.message : 'Confirm failed';

    if (message.includes('YIELD_JOB_MISSING') || message.includes('enqueue')) {
      try {
        await enqueueYieldBatchJobs(batchId);
      } catch {
        /* distribution job may already be queued */
      }
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
