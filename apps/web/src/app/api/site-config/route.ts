import { NextResponse } from 'next/server';
import { getPublicPlatformConfig } from '../../../lib/platform/platformConfigService';

export async function GET() {
  try {
    const config = await getPublicPlatformConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[site-config]', error);
    return NextResponse.json({ error: 'Failed to load site config' }, { status: 500 });
  }
}
