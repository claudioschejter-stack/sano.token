import { prisma } from '@sanova/database';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';

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
              user: { select: { email: true, name: true } }
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
    clientName,
    clientEmail: user.email
  };
}

export async function notifyAdvisorOfClientKycApproved(investorUserId: string): Promise<void> {
  const context = await loadIncorporatingAdvisor(investorUserId);
  if (!context) {
    return;
  }

  const subject = `Cliente KYC aprobado: ${context.clientName}`;
  const text = `Tu cliente ${context.clientName} (${context.clientEmail}) completó KYC y fue aprobado. Ya puede operar en el marketplace.`;

  await sendTransactionalEmail({
    to: context.advisorEmail,
    subject,
    text,
    html: `<p>${text}</p>`
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

  const subject = `Compra de tu cliente: ${context.clientName}`;
  const text = `${context.clientName} (${context.clientEmail}) compró tokens en "${projectTitle}" por USD ${amountUsd.toFixed(2)}. Las comisiones se acumulan según la política vigente.`;

  await sendTransactionalEmail({
    to: context.advisorEmail,
    subject,
    text,
    html: `<p>${text}</p>`
  });
}
