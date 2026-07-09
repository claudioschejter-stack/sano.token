import { NextResponse } from 'next/server';
import { requireAdminSession } from '../../../../lib/admin/requireAdmin';
import { prisma } from '@sanova/database';

export const dynamic = 'force-dynamic';

/**
 * One-off remediation: applies the `Notification` table migration
 * (packages/database/prisma/migrations/20260704000000_add_notifications)
 * directly against production, since `prisma migrate deploy` isn't wired
 * into the Vercel build and DATABASE_URL/DIRECT_URL are write-only secrets
 * we can't read locally to run it via the CLI.
 *
 * Every statement mirrors the migration file exactly and is guarded with
 * IF NOT EXISTS, so this is safe to call more than once. Admin-only.
 */
export async function POST() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS "Notification" (
      "id"        TEXT NOT NULL,
      "userId"    TEXT NOT NULL,
      "type"      TEXT NOT NULL,
      "title"     TEXT NOT NULL,
      "body"      TEXT NOT NULL,
      "link"      TEXT,
      "read"      BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "readAt"    TIMESTAMP(3),

      CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read")`,
    `CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt")`,
    `DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey'
      ) THEN
        ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$`
  ];

  try {
    for (const sql of statements) {
      await prisma.$executeRawUnsafe(sql);
    }

    const [{ exists }] = await prisma.$queryRawUnsafe<[{ exists: boolean }]>(
      `SELECT to_regclass('"Notification"') IS NOT NULL AS exists`
    );

    return NextResponse.json({ ok: true, tableReady: exists });
  } catch (error) {
    console.error('[admin/run-notifications-migration]', error);
    const message = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
