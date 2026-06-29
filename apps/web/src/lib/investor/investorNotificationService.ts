import { prisma } from '@sanova/database';
import { sendTransactionalEmail } from '../email/sendTransactionalEmail';

async function loadInvestorContext(investorUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: investorUserId },
    select: {
      email: true,
      name: true,
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
    clientName
  };
}

export async function notifyInvestorOfKycApproved(investorUserId: string): Promise<void> {
  const context = await loadInvestorContext(investorUserId);
  if (!context) return;

  const subject = `¡Tu cuenta en Sanova Capital ha sido aprobada!`;
  const text = `Hola ${context.clientName},\n\nTu proceso de verificación de identidad (KYC) ha sido aprobado exitosamente.\n\nYa puedes acceder a la plataforma y comenzar a invertir en el marketplace de Sanova Capital.\n\nSaludos,\nEl equipo de Sanova Global`;
  
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <p>Hola <strong>${context.clientName}</strong>,</p>
      <p>Tu proceso de verificación de identidad (KYC) ha sido <strong>aprobado exitosamente</strong>.</p>
      <p>Ya puedes acceder a la plataforma y comenzar a invertir en el marketplace de Sanova Capital.</p>
      <p style="margin-top:24px;color:#475569;font-size:14px">Saludos,<br>El equipo de Sanova Global</p>
    </div>
  `;

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

  const subject = `Confirmación de inversión: ${projectTitle}`;
  const text = `Hola ${context.clientName},\n\nHemos recibido tu inversión de USD ${amountUsd.toFixed(2)} en el proyecto "${projectTitle}".\n\nPuedes hacer seguimiento de tus activos y rendimientos desde el panel de control de tu cuenta.\n\nGracias por confiar en Sanova Capital.\n\nSaludos,\nEl equipo de Sanova Global`;
  
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5">
      <p>Hola <strong>${context.clientName}</strong>,</p>
      <p>Hemos confirmado tu inversión en la plataforma.</p>
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 8px 0"><strong>Proyecto:</strong> ${projectTitle}</p>
        <p style="margin:0"><strong>Monto invertido:</strong> USD ${amountUsd.toFixed(2)}</p>
      </div>
      <p>Puedes hacer seguimiento de tus activos y rendimientos desde el panel de control de tu cuenta.</p>
      <p style="margin-top:24px;color:#475569;font-size:14px">Gracias por confiar en Sanova Capital.<br>El equipo de Sanova Global</p>
    </div>
  `;

  await sendTransactionalEmail({
    to: context.clientEmail,
    subject,
    text,
    html
  });
}