import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import {
  auditAssetGovernance,
  enforceAssetGovernance
} from '../../../../lib/blockchain/assetGovernance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Admin: are all tokenized assets under the target wallet architecture?
 * Governance Safe owns token + vault, KYC module scoped to each token.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const projectId = new URL(request.url).searchParams.get('projectId')?.trim() || undefined;

  try {
    const audit = await auditAssetGovernance(projectId);
    return NextResponse.json({ ok: true, audit });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AUDIT_FAILED';
    console.error('[admin/asset-governance] audit', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Admin: migrate assets to the governance Safe and scope them in the KYC module.
 * Body: `{ projectId?, dryRun? }`
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    dryRun?: boolean;
  };

  try {
    const result = await enforceAssetGovernance({
      projectId: body.projectId?.trim() || undefined,
      dryRun: body.dryRun
    });

    return NextResponse.json(
      { ok: result.audit.compliant, ...result },
      { status: result.audit.compliant ? 200 : 409 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ENFORCE_FAILED';
    console.error('[admin/asset-governance] enforce', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
