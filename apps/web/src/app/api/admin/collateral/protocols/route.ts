import { NextResponse } from 'next/server';
import { getCollateralIntegrationStatus } from '../../../../../lib/collateral/collateralOrchestrator';
import { requireAdminSession } from '../../../../../lib/admin/requireAdmin';

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const protocols = getCollateralIntegrationStatus();
  const webhookConfigured = Boolean(process.env.COLLATERAL_SUBMISSION_WEBHOOK_URL?.trim());

  return NextResponse.json({
    protocols,
    webhookConfigured,
    autoRegistrationEnabled: webhookConfigured || protocols.some((p) => p.credentialsConfigured)
  });
}
