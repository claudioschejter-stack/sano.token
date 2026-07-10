import type { EmailMessagesPatch } from './types';

export const fr: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: "L'équipe Sanova Global"
  },
  activation: {
    subject: 'Activez votre compte — Sanova Global',
    intro: 'Merci de vous être inscrit sur Sanova Global.',
    cta: 'Activer votre compte',
    expiry: "Ce lien expire dans 24 heures. Si vous n'avez pas créé ce compte, vous pouvez ignorer ce message."
  },
  verificationCode: {
    subject: 'Votre code de vérification Sanova Global',
    label: 'Votre code de vérification Sanova est :',
    expiry: 'Ce code expire dans 10 minutes.',
    ignore: "Si vous n'avez pas demandé cet accès, vous pouvez ignorer ce message."
  },
  passwordReset: {
    subject: 'Réinitialisez votre mot de passe — Sanova Global',
    intro: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte Sanova.',
    cta: 'Réinitialiser le mot de passe',
    expiry: "Ce lien expire dans 1 heure. Si vous n'avez pas demandé ce changement, vous pouvez ignorer ce message."
  },
  accountApproved: {
    subject: 'Votre compte Sanova Capital a été approuvé !',
    greeting: 'Bonjour {name},',
    approvedLine: "Votre vérification d'identité (KYC) a été approuvée avec succès et votre compte est prêt.",
    accessLine: 'Vous pouvez désormais accéder à la plateforme et investir sur le marketplace de Sanova Capital.',
    cta: 'Accéder à la plateforme',
    closing: 'Cordialement,'
  },
  purchaseConfirmation: {
    subject: "Confirmation d'investissement : {project}",
    greeting: 'Bonjour {name},',
    receivedLine: 'Nous avons reçu votre investissement de {amount} USD dans le projet « {project} ».',
    confirmedLine: 'Nous avons confirmé votre investissement sur la plateforme.',
    projectLabel: 'Projet :',
    amountLabel: 'Montant investi :',
    trackingLine: 'Vous pouvez suivre vos actifs et rendements depuis le tableau de bord de votre compte.',
    thanks: 'Merci de faire confiance à Sanova Capital.'
  },
  advisorClientApproved: {
    subject: 'KYC client approuvé : {clientName}',
    body: 'Votre client {clientName} ({clientEmail}) a terminé son KYC et a été approuvé. Il/elle peut désormais opérer sur le marketplace.'
  },
  advisorClientPurchase: {
    subject: 'Achat de votre client : {clientName}',
    body: '{clientName} ({clientEmail}) a acheté des tokens dans « {project} » pour {amount} USD. Les commissions s\'accumulent selon la politique en vigueur.'
  },
  invite: {
    investorSubject: 'Invitation Sanova Global — Investisseur',
    teamSubject: 'Invitation Sanova Global — {roleLabel}',
    greeting: 'Bonjour{name},',
    investorBody:
      'Vous avez été invité(e) à investir dans des actifs tokenisés avec Sanova Global. Pour accepter l\'invitation et démarrer votre vérification KYC, ouvrez ce lien :',
    teamBody:
      'Vous avez été invité(e) à rejoindre Sanova Global en tant que {roleLabel}. Pour accepter l\'invitation et poursuivre la vérification KYC, ouvrez ce lien :',
    reminderPrefix: 'Rappel : ',
    cta: "Accepter l'invitation",
    expiry: 'Ce lien expire dans 7 jours.',
    ignore: "Si vous ne vous attendiez pas à cet e-mail, vous pouvez l'ignorer.",
    roleAdvisor: 'Conseiller',
    roleAdvisorManager: 'Responsable'
  }
};
