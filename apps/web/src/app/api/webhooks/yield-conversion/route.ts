import { NextResponse } from 'next/server';
import { verifyHmacSignature } from '../../../../lib/payments/webhookSecurity';
import { handleYieldConversionWebhook } from '../../../../lib/yield/yieldWebhookHandler';

export const dynamic = 'force-dynamic';

/**
 * Generic yield conversion webhook — ARS exchange, Coinbase Advanced Trade, manual ops.
 * Body: { batchId?, conversionRef?, usdcAmount, conversionTxHash?, status?, error? }
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const signature =
    request.headers.get('x-yield-signature') ??
    request.headers.get('x-webhook-signature') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (
    !verifyHmacSignature({
      secret: process.env.YIELD_CONVERSION_WEBHOOK_SECRET,
      payload,
      signature
    })
  ) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  const body = JSON.parse(payload) as {
    batchId?: string;
    conversionRef?: string;
    usdcAmount?: number | string;
    conversionTxHash?: string;
    status?: 'completed' | 'failed';
    error?: string;
    provider?: string;
  };

  const result = await handleYieldConversionWebhook({
    batchId: body.batchId,
    conversionRef: body.conversionRef,
    usdcAmount: body.usdcAmount,
    conversionTxHash: body.conversionTxHash,
    provider: body.provider ?? 'yield-conversion',
    status: body.status ?? 'completed',
    error: body.error,
    payload: body as Record<string, unknown>
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.reason === 'BATCH_NOT_FOUND' ? 404 : 400 });
  }

  return NextResponse.json(result);
}
