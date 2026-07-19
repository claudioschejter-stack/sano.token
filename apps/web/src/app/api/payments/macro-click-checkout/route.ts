import { NextResponse } from 'next/server';
import {
  investorSessionForbiddenResponse,
  requireInvestorSession
} from '../../../../lib/onboarding/requireInvestorSession';
import { createMacroClickHostedCheckout } from '../../../../lib/payments/macroClick/checkoutAdapter';
import { extractClientIp } from '../../../../lib/payments/macroClick/ipAllowlist';
import { isMacroClickConfigured } from '../../../../lib/payments/macroClick/config';

export const dynamic = 'force-dynamic';

/**
 * Builds encrypted POST fields for Macro Botón de Integración (token purchase / deposit).
 * Body: { referenceId, referenceKind: 'deposit'|'cart', amountUsd, label?, currency?, redirectPath? }
 */
export async function POST(request: Request) {
  const ctx = await requireInvestorSession();
  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  if ('forbidden' in ctx) {
    return investorSessionForbiddenResponse(ctx);
  }
  if (!isMacroClickConfigured()) {
    return NextResponse.json({ error: 'MACRO_CLICK_NOT_CONFIGURED' }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    referenceId?: string;
    referenceKind?: 'deposit' | 'cart';
    amountUsd?: number;
    label?: string;
    currency?: 'ARS' | 'USD';
    redirectPath?: string;
  } | null;

  if (!body?.referenceId?.trim() || !body.referenceKind || !(Number(body.amountUsd) > 0)) {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const checkout = createMacroClickHostedCheckout({
    referenceId: body.referenceId.trim(),
    referenceKind: body.referenceKind,
    amount: Number(body.amountUsd),
    currency: body.currency ?? 'ARS',
    label: body.label?.trim() || 'Compra Sanova RWA',
    userId: ctx.userId,
    userEmail: ctx.email,
    clientIp: extractClientIp(request) ?? '127.0.0.1',
    redirectPath: body.redirectPath
  });

  return NextResponse.json({
    ok: true,
    provider: checkout.provider,
    providerPaymentId: checkout.providerPaymentId,
    formFields: checkout.metadata.formFields,
    actionUrl: (checkout.metadata.formFields as { actionUrl?: string } | undefined)?.actionUrl ?? null
  });
}
