import type { EmailMessagesPatch } from './types';

export const es: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'El equipo de Sanova Global'
  },
  activation: {
    subject: 'Activá tu cuenta — Sanova Global',
    intro: 'Gracias por registrarte en Sanova Global.',
    cta: 'Activá tu cuenta',
    expiry: 'El enlace vence en 24 horas. Si no creaste esta cuenta, ignorá este mensaje.'
  },
  verificationCode: {
    subject: 'Tu código de verificación de Sanova Global',
    label: 'Tu código de verificación Sanova es:',
    expiry: 'Este código vence en 10 minutos.',
    ignore: 'Si no solicitaste este acceso, podés ignorar este mensaje.'
  },
  passwordReset: {
    subject: 'Restablecé tu contraseña — Sanova Global',
    intro: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta Sanova.',
    cta: 'Restablecer contraseña',
    expiry: 'El enlace vence en 1 hora. Si no solicitaste este cambio, ignorá este mensaje.'
  },
  accountApproved: {
    subject: '¡Tu cuenta en Sanova Capital ha sido aprobada!',
    greeting: 'Hola {name},',
    approvedLine:
      'Tu proceso de verificación de identidad (KYC) ha sido aprobado exitosamente y tu cuenta ya está lista.',
    accessLine: 'Ya puedes acceder a la plataforma y comenzar a invertir en el marketplace de Sanova Capital.',
    cta: 'Ir a la plataforma',
    closing: 'Saludos,'
  },
  purchaseConfirmation: {
    subject: 'Confirmación de inversión: {project}',
    greeting: 'Hola {name},',
    receivedLine: 'Hemos recibido tu inversión de USD {amount} en el proyecto "{project}".',
    confirmedLine: 'Hemos confirmado tu inversión en la plataforma.',
    projectLabel: 'Proyecto:',
    amountLabel: 'Monto invertido:',
    trackingLine: 'Puedes hacer seguimiento de tus activos y rendimientos desde el panel de control de tu cuenta.',
    thanks: 'Gracias por confiar en Sanova Capital.'
  },
  advisorClientApproved: {
    subject: 'Cliente KYC aprobado: {clientName}',
    body: 'Tu cliente {clientName} ({clientEmail}) completó KYC y fue aprobado. Ya puede operar en el marketplace.'
  },
  advisorClientPurchase: {
    subject: 'Compra de tu cliente: {clientName}',
    body: '{clientName} ({clientEmail}) compró tokens en "{project}" por USD {amount}. Las comisiones se acumulan según la política vigente.'
  },
  invite: {
    investorSubject: 'Invitación Sanova Global — Inversor',
    teamSubject: 'Invitación Sanova Global — {roleLabel}',
    greeting: 'Hola{name},',
    investorBody:
      'Fuiste invitado a invertir en activos tokenizados de Sanova Global. Para aceptar la invitación y comenzar tu verificación KYC, abrí este enlace:',
    teamBody:
      'Fuiste invitado a unirte a Sanova Global como {roleLabel}. Para aceptar la invitación y continuar con la verificación KYC, abrí este enlace:',
    reminderPrefix: 'Recordatorio: ',
    cta: 'Aceptar invitación',
    expiry: 'El enlace vence en 7 días.',
    ignore: 'Si no esperabas este correo, podés ignorarlo.',
    roleAdvisor: 'Asesor',
    roleAdvisorManager: 'Gerente'
  }
};
