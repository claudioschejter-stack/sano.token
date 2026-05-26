import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../../../lib/admin/requireAdmin';
import { executeProjectAutomationRepair } from '../../../../../../lib/blockchain/projectTokenDeploy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { projectId } = await context.params;

  try {
    const result = await executeProjectAutomationRepair(projectId);
    if (!result.asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[admin/assets/repair-automation]', error);
    return NextResponse.json({ error: 'Automation repair failed' }, { status: 500 });
  }
}
