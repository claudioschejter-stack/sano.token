import type { EmailMessagesPatch } from './types';

export const pt: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'A equipe Sanova Global'
  },
  activation: {
    subject: 'Ative sua conta — Sanova Global',
    intro: 'Obrigado por se registrar na Sanova Global.',
    cta: 'Ativar sua conta',
    expiry: 'Este link expira em 24 horas. Se você não criou esta conta, pode ignorar esta mensagem.'
  },
  verificationCode: {
    subject: 'Seu código de verificação Sanova Global',
    label: 'Seu código de verificação Sanova é:',
    expiry: 'Este código expira em 10 minutos.',
    ignore: 'Se você não solicitou este acesso, pode ignorar esta mensagem.'
  },
  passwordReset: {
    subject: 'Redefina sua senha — Sanova Global',
    intro: 'Recebemos uma solicitação para redefinir a senha da sua conta Sanova.',
    cta: 'Redefinir senha',
    expiry: 'Este link expira em 1 hora. Se você não solicitou esta alteração, pode ignorar esta mensagem.'
  },
  accountApproved: {
    subject: 'Sua conta na Sanova Capital foi aprovada!',
    greeting: 'Olá {name},',
    approvedLine: 'Sua verificação de identidade (KYC) foi aprovada com sucesso e sua conta já está pronta.',
    accessLine: 'Você já pode acessar a plataforma e começar a investir no marketplace da Sanova Capital.',
    cta: 'Ir para a plataforma',
    closing: 'Atenciosamente,'
  },
  purchaseConfirmation: {
    subject: 'Confirmação de investimento: {project}',
    greeting: 'Olá {name},',
    receivedLine: 'Recebemos seu investimento de USD {amount} no projeto "{project}".',
    confirmedLine: 'Confirmamos seu investimento na plataforma.',
    projectLabel: 'Projeto:',
    amountLabel: 'Valor investido:',
    trackingLine: 'Você pode acompanhar seus ativos e rendimentos no painel da sua conta.',
    thanks: 'Obrigado por confiar na Sanova Capital.'
  },
  advisorClientApproved: {
    subject: 'KYC do cliente aprovado: {clientName}',
    body: 'Seu cliente {clientName} ({clientEmail}) concluiu o KYC e foi aprovado. Ele(a) já pode operar no marketplace.'
  },
  advisorClientPurchase: {
    subject: 'Compra do seu cliente: {clientName}',
    body: '{clientName} ({clientEmail}) comprou tokens em "{project}" por USD {amount}. As comissões são acumuladas de acordo com a política vigente.'
  },
  invite: {
    investorSubject: 'Convite Sanova Global — Investidor',
    teamSubject: 'Convite Sanova Global — {roleLabel}',
    greeting: 'Olá{name},',
    investorBody:
      'Você foi convidado a investir em ativos tokenizados da Sanova Global. Para aceitar o convite e iniciar sua verificação KYC, abra este link:',
    teamBody:
      'Você foi convidado a se juntar à Sanova Global como {roleLabel}. Para aceitar o convite e continuar com a verificação KYC, abra este link:',
    reminderPrefix: 'Lembrete: ',
    cta: 'Aceitar convite',
    expiry: 'Este link expira em 7 dias.',
    ignore: 'Se você não esperava este e-mail, pode ignorá-lo.',
    roleAdvisor: 'Assessor',
    roleAdvisorManager: 'Gerente'
  }
};
