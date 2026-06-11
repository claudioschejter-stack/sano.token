import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';
import { auditPlatformOperationalReadiness } from '../../../../../lib/admin/platformOperationalReadiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const report = await auditPlatformOperationalReadiness();
    return NextResponse.json(report);
  } catch (error) {
    console.error('[admin/operations/readiness]', error);
    return NextResponse.json({ error: 'Readiness audit failed' }, { status: 500 });
  }
}
