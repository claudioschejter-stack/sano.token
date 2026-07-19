import { NextResponse } from 'next/server';
import { isProductionRuntime } from '../../../../lib/runtime/environment';
import { extractClientIp, isMacroClickWebhookIpAllowed } from '../../../../lib/payments/macroClick/ipAllowlist';
import { handleMacroClickWebhook } from '../../../../lib/payments/macroClick/webhookHandler';
import type { MacroClickWebhookPayload } from '../../../../lib/payments/macroClick/types';

export const dynamic = 'force-dynamic';

/**
 * Click de Pago notifications (PAGO / TRANSACCIÓN / DEVOLUCIÓN / link events).
 * Must return 200 quickly; heavy settlement runs in-process but should stay under Macro's timeout.
 */
export async function POST(request: Request) {
  const ip = extractClientIp(request);
  if (isProductionRuntime() && !isMacroClickWebhookIpAllowed(ip)) {
    return NextResponse.json({ error: 'FORBIDDEN_IP', ip }, { status: 403 });
  }

  let payload: MacroClickWebhookPayload;
  try {
    payload = (await request.json()) as MacroClickWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  try {
    const result = await handleMacroClickWebhook(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[webhooks/macro-click]', error);
    return NextResponse.json(
      { error: 'WEBHOOK_HANDLER_FAILED', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
