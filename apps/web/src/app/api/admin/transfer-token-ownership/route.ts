import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { transferTokenOwnershipToOperator } from '../../../../lib/blockchain/transferTokenOwnershipToOperator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Admin one-off: move token/vault ownership from the legacy deploy EOA to the
 * Privy operator wallet so the server can call `setKyc` (owner-only) and
 * whitelist investors without a private key at request time.
 *
 * Body: `{ projectId, newOwner?, includeVault? }`
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    newOwner?: string;
    includeVault?: boolean;
  };

  if (!body.projectId?.trim()) {
    return NextResponse.json({ error: 'PROJECT_ID_REQUIRED' }, { status: 400 });
  }

  try {
    const result = await transferTokenOwnershipToOperator({
      projectId: body.projectId.trim(),
      newOwner: body.newOwner ?? null,
      includeVault: body.includeVault
    });

    const ok = result.steps.every((step) => step.ok);
    return NextResponse.json({ ok, result }, { status: ok ? 200 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TRANSFER_OWNERSHIP_FAILED';
    console.error('[admin/transfer-token-ownership]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
