import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { auth } from '../../../../auth';
import { locales, type Locale } from '../../../../i18n';

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = (await request.json()) as { preferredLocale?: string | null };
  const locale = body.preferredLocale?.trim();

  if (!locale || !locales.includes(locale as Locale)) {
    return NextResponse.json({ error: 'INVALID_LOCALE' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { preferredLocale: locale }
  });

  return NextResponse.json({ ok: true, preferredLocale: locale });
}
