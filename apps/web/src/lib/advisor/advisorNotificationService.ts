import { prisma } from '@sanova/database';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';
import { renderEmailShell } from '../email/emailTemplate';
import { getEmailMessages, applyEmailTemplate } from '../email/emailMessages';

async function loadIncorporatingAdvisor(investorUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: investorUserId },
    select: {
      email: true,
      name: true,
      investor: {
        select: {
          fullName: true,
          incorporatedBy: {
            select: {
              user: { select: { email: true, name: true, preferredLocale: true } }
            }
          }
        }
      }
    }
  });

  const advisorEmail = user?.investor?.incorporatedBy?.user.email;
  if (!advisorEmail) {
    return null;
  }

  const clientName =
    user.investor?.fullName ?? user.name ?? user.email;

  return {
    advisorEmail,
    advisorLocale: user.investor?.incorporatedBy?.user.preferredLocale ?? null,
    clientName,
    clientEmail: user.email
  };
}

export async function notifyAdvisorOfClientKycApproved(investorUserId: string): Promise<void> {
  const context = await loadIncorporatingAdvisor(investorUserId);
  if (!context) {
    return;
  }

  const m = getEmailMessages(context.advisorLocale);
  const subject = applyEmailTemplate(m.advisorClientApproved.subject, { clientName: context.clientName });
  const text = applyEmailTemplate(m.advisorClientApproved.body, {
    clientName: context.clientName,
    clientEmail: context.clientEmail
  });

  await sendTransactionalEmail({
    to: context.advisorEmail,
    subject,
    text,
    html: renderEmailShell({ locale: context.advisorLocale, bodyHtml: `<p>${text}</p>` })
  });
}

export async function notifyAdvisorOfClientPurchase(
  investorUserId: string,
  projectTitle: string,
  amountUsd: number
): Promise<void> {
  const context = await loadIncorporatingAdvisor(investorUserId);
  if (!context) {
    return;
  }

  const m = getEmailMessages(context.advisorLocale);
  const subject = applyEmailTemplate(m.advisorClientPurchase.subject, { clientName: context.clientName });
  const text = applyEmailTemplate(m.advisorClientPurchase.body, {
    clientName: context.clientName,
    clientEmail: context.clientEmail,
    project: projectTitle,
    amount: amountUsd.toFixed(2)
  });

  await sendTransactionalEmail({
    to: context.advisorEmail,
    subject,
    text,
    html: renderEmailShell({ locale: context.advisorLocale, bodyHtml: `<p>${text}</p>` })
  });
}
