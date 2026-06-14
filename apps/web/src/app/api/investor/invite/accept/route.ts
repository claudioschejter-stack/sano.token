import { NextResponse } from 'next/server';
import { acceptInvestorInvite } from '../../../../../lib/admin/investorInviteService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');

  try {
    const { redirectUrl } = await acceptInvestorInvite(token ?? '');
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const fallback = new URL('/acceso', request.url);
    fallback.searchParams.set('inviteError', code);
    return NextResponse.redirect(fallback);
  }
}
