import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { createMacroRentCharge } from '../../../../../../lib/payments/macroClick/rentLinkService';
import { isMacroClickConfigured } from '../../../../../../lib/payments/macroClick/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/**
 * Admin: create Macro payment link/QR for a property rent (ARS or USD).
 * When the tenant pays, webhook → creditAndDistributeOperatingRent → USDC/Privy for holders.
 */
export async function POST(request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isMacroClickConfigured()) {
    return NextResponse.json({ error: 'MACRO_CLICK_NOT_CONFIGURED' }, { status: 503 });
  }

  const { projectId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    amount?: number;
    currency?: 'ARS' | 'USD';
    periodKey?: string;
    tenantKey?: string;
    tenantEmail?: string;
    description?: string;
    mode?: 'link' | 'qr' | 'qr_multi';
    dues?: Array<{ dueDate: string; amount: number }>;
  };

  if (!Number.isFinite(body.amount) || (body.amount ?? 0) <= 0) {
    return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 });
  }
  if (!body.periodKey?.trim()) {
    return NextResponse.json({ error: 'PERIOD_KEY_REQUIRED' }, { status: 400 });
  }
  const currency = body.currency === 'USD' ? 'USD' : 'ARS';

  try {
    const charge = await createMacroRentCharge({
      projectId,
      periodKey: body.periodKey.trim(),
      amount: body.amount!,
      currency,
      tenantKey: body.tenantKey,
      tenantEmail: body.tenantEmail,
      description: body.description,
      mode: body.mode ?? 'link',
      dues: body.dues
    });
    return NextResponse.json({ ok: true, ...charge });
  } catch (error) {
    console.error('[rent-macro-charge]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'MACRO_RENT_CHARGE_FAILED' },
      { status: 502 }
    );
  }
}
