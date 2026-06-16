import { NextResponse } from 'next/server';
import { buildPublicNavReport } from '../../../../lib/nav/navOraclePublic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

/** Same NAV payload at /api/nav/:slug for programmatic access. */
export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const report = await buildPublicNavReport(slug);
    if (!report) {
      return NextResponse.json({ error: 'NAV report not found' }, { status: 404 });
    }

    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('[api/nav/slug]', error);
    return NextResponse.json({ error: 'Failed to load NAV report' }, { status: 500 });
  }
}
