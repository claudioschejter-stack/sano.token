import { NextResponse } from 'next/server';
import { prisma } from '@sanova/database';
import { auth } from '../../../../auth';
import { locales, type Locale } from '../../../../i18n';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      preferredLocale: true,
      preferredTheme: true,
      jurisdiction: true,
      pwaInstalledAt: true,
      pwaDismissedAt: true
    }
  });

  if (!user) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = (await request.json()) as {
    preferredLocale?: string | null;
    preferredTheme?: string | null;
    jurisdiction?: string | null;
    pwaInstalled?: boolean;
    pwaDismissed?: boolean;
  };

  const data: {
    preferredLocale?: string;
    preferredTheme?: string;
    jurisdiction?: string | null;
    pwaInstalledAt?: Date;
    pwaDismissedAt?: Date;
  } = {};

  if (body.preferredLocale !== undefined) {
    const locale = body.preferredLocale?.trim();
    if (!locale || !locales.includes(locale as Locale)) {
      return NextResponse.json({ error: 'INVALID_LOCALE' }, { status: 400 });
    }
    data.preferredLocale = locale;
  }

  if (body.preferredTheme !== undefined) {
    const theme = body.preferredTheme?.trim();
    if (theme !== 'light' && theme !== 'dark') {
      return NextResponse.json({ error: 'INVALID_THEME' }, { status: 400 });
    }
    data.preferredTheme = theme;
  }

  if (body.jurisdiction !== undefined) {
    data.jurisdiction = body.jurisdiction?.trim().toUpperCase() || null;
  }

  if (body.pwaInstalled) {
    data.pwaInstalledAt = new Date();
  }

  if (body.pwaDismissed) {
    data.pwaDismissedAt = new Date();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'NO_CHANGES' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      preferredLocale: true,
      preferredTheme: true,
      jurisdiction: true,
      pwaInstalledAt: true,
      pwaDismissedAt: true
    }
  });

  return NextResponse.json({ ok: true, ...user });
}
