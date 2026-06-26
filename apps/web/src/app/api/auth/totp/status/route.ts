import { NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { prisma } from '@sanova/database';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ totpEnabled: false });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true }
  });

  return NextResponse.json({ totpEnabled: user?.totpEnabled ?? false });
}
