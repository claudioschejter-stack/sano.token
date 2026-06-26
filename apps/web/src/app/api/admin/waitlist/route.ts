import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { prisma } from '@sanova/database';

/** GET /api/admin/waitlist?projectId=xxx
 *  Returns waitlist entries. Restricted to admin users only.
 *  Optional query param: projectId — filter by specific property.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true }
  });

  if (user?.systemRole !== 'ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') ?? undefined;

  const entries = await prisma.waitlistEntry.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: { createdAt: 'desc' }
  });

  // Group by projectId for convenience
  const byProject: Record<string, { email: string; createdAt: string }[]> = {};
  for (const entry of entries) {
    if (!byProject[entry.projectId]) byProject[entry.projectId] = [];
    byProject[entry.projectId]!.push({
      email: entry.email,
      createdAt: entry.createdAt.toISOString()
    });
  }

  return NextResponse.json({
    total: entries.length,
    entries,
    byProject
  });
}

/** DELETE /api/admin/waitlist?id=xxx — remove a single entry */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true }
  });

  if (user?.systemRole !== 'ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  await prisma.waitlistEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
