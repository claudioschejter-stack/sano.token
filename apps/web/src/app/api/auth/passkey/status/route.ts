import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { userHasPasskeys } from '../../../../../lib/auth/passkeyService';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ hasPasskeys: false });
  }

  const hasPasskeys = await userHasPasskeys(userId);
  return NextResponse.json({ hasPasskeys });
}
