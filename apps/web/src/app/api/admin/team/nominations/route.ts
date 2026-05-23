import { NextResponse } from 'next/server';
import { listAdvisorNominations } from '../../../../../lib/admin/teamService';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import type { AdvisorNominationStatus } from '@sanova/database';

const VALID_STATUS = new Set<AdvisorNominationStatus>(['PENDING', 'APPROVED', 'REJECTED']);

export async function GET(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawStatus = (searchParams.get('status') ?? '').toUpperCase();
  const status = VALID_STATUS.has(rawStatus as AdvisorNominationStatus)
    ? (rawStatus as AdvisorNominationStatus)
    : undefined;

  try {
    const nominations = await listAdvisorNominations(status);
    return NextResponse.json({ nominations });
  } catch (error) {
    console.error('[admin/team/nominations GET]', error);
    return NextResponse.json({ error: 'Failed to load nominations' }, { status: 500 });
  }
}
