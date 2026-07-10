import { prisma } from '@sanova/database';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';
import { renderEmailShell, renderEmailButton } from '../email/emailTemplate';
import { getEmailMessages, applyEmailTemplate } from '../email/emailMessages';
import { siteBaseUrl } from '../onboarding/accountActivationService';

async function loadInvestorContext(investorUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: investorUserId },
    select: {
      email: true,
      name: true,
      preferredLocale: true,
      investor: {
        select: {
          fullName: true
        }
      }
    }
  });

  if (!user?.email) {
    return null;
  }

  const clientName = user.investor?.fullName ?? user.name ?? 'Inversor';

  return {
    clientEmail: user.email,
    clientName,
    preferredLocale: user.preferredLocale
  };
}

/**
 * Sends the "your account has been approved" email. Only call this once the
 * FULL registration pipeline is complete (KYC + wallet + security/TOTP —
 * see `isAccountOperational`), not merely on KYC approval, since the user
 * can't actually access the platform or invest until every step is done.
 */
export async function notifyInvestorAccountOperational(investorUserId: string): Promise<void> {
  const context = await loadInvestorContext(investorUserId);
  if (!context) return;

  const platformUrl = `${siteBaseUrl()}/dashboard`;
  const m = getEmailMessages(context.preferredLocale);
  const greeting = applyEmailTemplate(m.accountApproved.greeting, { name: context.clientName });

  const subject = m.accountApproved.subject;
  const text = [
    greeting,
    '',
    m.accountApproved.approvedLine,
    '',
    `${m.accountApproved.accessLine}`,
    platformUrl,
    '',
    m.accountApproved.closing,
    m.common.teamSignature
  ].join('\n');

  const html = renderEmailShell({
    locale: context.preferredLocale,
    bodyHtml: `
      <p>${applyEmailTemplate(m.accountApproved.greeting, { name: `<strong>${context.clientName}</strong>` })}</p>
      <p>${m.accountApproved.approvedLine}</p>
      <p>${m.accountApproved.accessLine}</p>
      ${renderEmailButton(platformUrl, m.accountApproved.cta)}
      <p style="margin-top:24px;color:#475569;font-size:14px">${m.accountApproved.closing}<br>${m.common.teamSignature}</p>
    `
  });

  await sendTransactionalEmail({
    to: context.clientEmail,
    subject,
    text,
    html
  });
}

export async function notifyInvestorOfPurchase(
  investorUserId: string,
  projectTitle: string,
  amountUsd: number
): Promise<void> {
  const context = await loadInvestorContext(investorUserId);
  if (!context) return;

  const m = getEmailMessages(context.preferredLocale);
  const subject = applyEmailTemplate(m.purchaseConfirmation.subject, { project: projectTitle });
  const greeting = applyEmailTemplate(m.purchaseConfirmation.greeting, { name: context.clientName });
  const receivedLine = applyEmailTemplate(m.purchaseConfirmation.receivedLine, {
    amount: amountUsd.toFixed(2),
    project: projectTitle
  });

  const text = [
    greeting,
    '',
    receivedLine,
    '',
    m.purchaseConfirmation.trackingLine,
    '',
    m.purchaseConfirmation.thanks,
    '',
    m.accountApproved.closing,
    m.common.teamSignature
  ].join('\n');

  const html = renderEmailShell({
    locale: context.preferredLocale,
    bodyHtml: `
      <p>${applyEmailTemplate(m.purchaseConfirmation.greeting, { name: `<strong>${context.clientName}</strong>` })}</p>
      <p>${m.purchaseConfirmation.confirmedLine}</p>
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 8px 0"><strong>${m.purchaseConfirmation.projectLabel}</strong> ${projectTitle}</p>
        <p style="margin:0"><strong>${m.purchaseConfirmation.amountLabel}</strong> USD ${amountUsd.toFixed(2)}</p>
      </div>
      <p>${m.purchaseConfirmation.trackingLine}</p>
      <p style="margin-top:24px;color:#475569;font-size:14px">${m.purchaseConfirmation.thanks}<br>${m.common.teamSignature}</p>
    `
  });

  await sendTransactionalEmail({
    to: context.clientEmail,
    subject,
    text,
    html
  });
}