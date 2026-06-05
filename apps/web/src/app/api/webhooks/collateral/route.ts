import { NextResponse } from 'next/server';
import { updateAdminAsset, getAdminAsset } from '../../../../lib/admin/assetsService';
import type { CollateralProtocol } from '../../../../lib/admin/launchTypes';
import { verifySharedSecret } from '../../../../lib/payments/webhookSecurity';

type WebhookBody = {
  projectId: string;
  protocol: CollateralProtocol;
  status: 'REGISTERED' | 'REJECTED';
  externalId?: string;
  poolUrl?: string;
  reason?: string;
};

export async function POST(request: Request) {
  if (
    !verifySharedSecret({
      secret: process.env.COLLATERAL_WEBHOOK_SECRET,
      provided: request.headers.get('x-sanova-webhook-secret')
    })
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as WebhookBody;

  if (!body.projectId || !body.protocol || !body.status) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const asset = await getAdminAsset(body.projectId);
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const targets = asset.collateralTargets.map((target) => {
    if (target.protocol !== body.protocol) {
      return target;
    }

    return {
      ...target,
      status: body.status,
      externalId: body.externalId ?? target.externalId ?? null,
      poolUrl: body.poolUrl ?? target.poolUrl ?? null,
      notes: body.reason ?? target.notes,
      registeredAt: body.status === 'REGISTERED' ? new Date().toISOString() : target.registeredAt ?? null,
      lastError: body.status === 'REJECTED' ? body.reason ?? 'REJECTED' : null
    };
  });

  const updated = await updateAdminAsset(body.projectId, { collateralTargets: targets });
  return NextResponse.json({ asset: updated });
}
