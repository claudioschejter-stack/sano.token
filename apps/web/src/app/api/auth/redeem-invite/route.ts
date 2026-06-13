import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { redeemInvestorInviteCode } from '../../../../lib/auth/redeemInviteService';

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { inviteCode?: string };
  try {
    body = (await request.json()) as { inviteCode?: string };
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  try {
    const result = await redeemInvestorInviteCode(
      session.user.id,
      session.user.email,
      body.inviteCode ?? ''
    );
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    const status =
      code === 'INVALID_INVITE_CODE' || code === 'NOT_INVESTOR' ? 400 : code === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
