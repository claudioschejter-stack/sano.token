import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '../../../../lib/onboarding/requireAuthenticatedSession';
import { enterPrizeCampaign } from '../../../../lib/prizes/prizeService';

export async function POST(request: Request) {
  const ctx = await requireAuthenticatedSession();

  if (!ctx) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = (await request.json()) as { campaignId?: string };
  const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : '';

  if (!campaignId) {
    return NextResponse.json({ error: 'INVALID_CAMPAIGN' }, { status: 400 });
  }

  try {
    const result = await enterPrizeCampaign({
      userId: ctx.userId,
      campaignId
    });

    return NextResponse.json({ ok: true, entryId: result.entryId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN';

    if (message === 'CAMPAIGN_NOT_FOUND') {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message === 'CAMPAIGN_NOT_ACTIVE' || message === 'KYC_REQUIRED') {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (
      message === 'CONTACT_PHONE_REQUIRED' ||
      message === 'CONTACT_NAME_REQUIRED' ||
      message === 'CONTACT_PORTRAIT_REQUIRED'
    ) {
      return NextResponse.json({ error: message }, { status: 422 });
    }

    console.error('[prizes/enter]', message);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
