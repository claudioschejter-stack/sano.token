import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { auditPlatformAlignment } from '../../../../lib/admin/platformAlignment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Admin: single source of truth for whether the platform is aligned with the
 * target architecture — Safe owns the assets, Privy runs the automation.
 */
export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const report = await auditPlatformAlignment();
    const blockers = report.issues.filter((issue) => issue.severity === 'BLOCKER');
    return NextResponse.json({
      ok: true,
      aligned: report.aligned,
      blockerCount: blockers.length,
      warnCount: report.issues.length - blockers.length,
      nextAction: blockers[0]?.fix ?? report.issues[0]?.fix ?? 'Todo alineado.',
      report
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PLATFORM_ALIGNMENT_FAILED';
    console.error('[admin/platform-alignment]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
