import { NextResponse } from 'next/server';
import { APP_VERSION } from '../../../generated/appVersion';

/**
 * Always reflects whatever server code is currently deployed — unlike the
 * client's own baked-in APP_VERSION, which can lag behind in an already-open
 * tab/PWA session until it reloads. Clients poll this to detect that a newer
 * build is live and prompt the user to refresh.
 */
export async function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
