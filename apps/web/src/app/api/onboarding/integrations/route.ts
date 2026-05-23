import { NextResponse } from 'next/server';
import { getOnboardingIntegrations } from '../../../../lib/onboarding/integrationStatus';

export const dynamic = 'force-dynamic';

export async function GET() {
  const integrations = getOnboardingIntegrations();

  return NextResponse.json({
    integrations,
    allConfigured: integrations.every((item) => item.configured)
  });
}
