import { createHash, randomInt } from 'crypto';
import { prisma } from '@sanova/database';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';
import { renderEmailShell } from '../email/emailTemplate';
import { getEmailMessages } from '../email/emailMessages';

/**
 * Second factor at login: a six digit code sent to the account's own email.
 *
 * It replaces the authenticator app on desktop. The reason is recoverability:
 * a TOTP secret lives on one phone, and losing it — or losing the backup codes
 * with it — locked the account for good with no way for support to help. An
 * emailed code has the inbox as its recovery path, which the account owner
 * already controls by definition.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 5;
const CHANNEL = 'EMAIL_LOGIN' as const;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

export type IssueLoginCodeResult =
  | { ok: true; delivered: boolean; deliveryError?: string; devCode?: string }
  | { ok: false; code: 'RATE_LIMIT'; retryAfterSeconds: number };

/**
 * Send a fresh code, invalidating any earlier one.
 *
 * Superseding rather than accumulating matters for a factor the user can ask to
 * resend: two live codes means the older one still opens the session, so a code
 * read over someone's shoulder stays useful after the user asks for another.
 */
export async function issueLoginEmailCode(input: {
  userId: string;
  email: string;
}): Promise<IssueLoginCodeResult> {
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await prisma.verificationCode.findMany({
    where: { userId: input.userId, channel: CHANNEL, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true }
  });

  if (recent.length >= MAX_CODES_PER_WINDOW) {
    const oldest = recent[0]!.createdAt.getTime();
    return {
      ok: false,
      code: 'RATE_LIMIT',
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - Date.now()) / 1000))
    };
  }

  const code = generateCode();

  await prisma.verificationCode.updateMany({
    where: { userId: input.userId, channel: CHANNEL, consumedAt: null },
    data: { consumedAt: new Date() }
  });

  await prisma.verificationCode.create({
    data: {
      userId: input.userId,
      channel: CHANNEL,
      target: input.email,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS)
    }
  });

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { preferredLocale: true }
  });
  const m = getEmailMessages(user?.preferredLocale);

  /**
   * The existing verification strings already read as access ("si no
   * solicitaste este acceso"), and they are translated into every locale the
   * platform ships. A parallel set would only add 17 files to drift apart.
   */
  const copy = m.verificationCode;

  /**
   * The code goes in the subject, first.
   *
   * It shows in the notification and the inbox list, so most logins never need
   * the message opened — and when the message does land in spam, a subject that
   * starts with the code is findable by searching for it. It also removes the
   * reason to put a link in a login email, which is the pattern phishing filters
   * are built to distrust.
   */
  const result = await sendTransactionalEmail({
    category: 'auth',
    to: input.email,
    subject: `${code} · ${copy.subject}`,
    text: [`${copy.label} ${code}`, '', copy.expiry, copy.ignore, '', m.common.brand].join('\n'),
    html: renderEmailShell({
      locale: user?.preferredLocale,
      bodyHtml: `
        <p>${copy.label}</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p>
        <p>${copy.expiry}</p>
        <p style="color:#475569;font-size:14px">${copy.ignore}</p>
      `
    })
  });

  if (!result.ok) {
    console.warn('[loginEmailCode] no se pudo enviar el código', result.error);
  }

  /**
   * Outside production the code comes back in the response so local logins do
   * not depend on a mail provider being configured.
   */
  const exposeDevCode =
    process.env.ONBOARDING_DEV_EXPOSE_CODE === 'true' || process.env.NODE_ENV !== 'production';

  return {
    ok: true,
    delivered: result.ok,
    deliveryError: result.error,
    ...(exposeDevCode ? { devCode: code } : {})
  };
}

/** True only for the newest unconsumed code, which is then spent. */
export async function consumeLoginEmailCode(input: {
  userId: string;
  code: string;
}): Promise<boolean> {
  const submitted = input.code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(submitted)) {
    return false;
  }

  const record = await prisma.verificationCode.findFirst({
    where: {
      userId: input.userId,
      channel: CHANNEL,
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!record || record.codeHash !== hashCode(submitted)) {
    return false;
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() }
  });

  return true;
}
