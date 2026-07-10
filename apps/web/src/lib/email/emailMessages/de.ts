import type { EmailMessagesPatch } from './types';

export const de: EmailMessagesPatch = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'Das Sanova Global-Team'
  },
  activation: {
    subject: 'Aktiviere dein Konto — Sanova Global',
    intro: 'Danke für deine Registrierung bei Sanova Global.',
    cta: 'Konto aktivieren',
    expiry: 'Dieser Link läuft in 24 Stunden ab. Wenn du dieses Konto nicht erstellt hast, kannst du diese Nachricht ignorieren.'
  },
  verificationCode: {
    subject: 'Dein Sanova Global-Bestätigungscode',
    label: 'Dein Sanova-Bestätigungscode lautet:',
    expiry: 'Dieser Code läuft in 10 Minuten ab.',
    ignore: 'Wenn du das nicht angefordert hast, kannst du diese Nachricht ignorieren.'
  },
  passwordReset: {
    subject: 'Setze dein Passwort zurück — Sanova Global',
    intro: 'Wir haben eine Anfrage zum Zurücksetzen des Passworts deines Sanova-Kontos erhalten.',
    cta: 'Passwort zurücksetzen',
    expiry: 'Dieser Link läuft in 1 Stunde ab. Wenn du diese Änderung nicht angefordert hast, kannst du diese Nachricht ignorieren.'
  },
  accountApproved: {
    subject: 'Dein Sanova Capital-Konto wurde genehmigt!',
    greeting: 'Hallo {name},',
    approvedLine: 'Deine Identitätsprüfung (KYC) wurde erfolgreich genehmigt und dein Konto ist bereit.',
    accessLine: 'Du kannst jetzt auf die Plattform zugreifen und im Sanova Capital-Marketplace investieren.',
    cta: 'Zur Plattform',
    closing: 'Beste Grüße,'
  },
  purchaseConfirmation: {
    subject: 'Investitionsbestätigung: {project}',
    greeting: 'Hallo {name},',
    receivedLine: 'Wir haben deine Investition von USD {amount} im Projekt „{project}“ erhalten.',
    confirmedLine: 'Wir haben deine Investition auf der Plattform bestätigt.',
    projectLabel: 'Projekt:',
    amountLabel: 'Investierter Betrag:',
    trackingLine: 'Du kannst deine Vermögenswerte und Renditen über dein Konto-Dashboard verfolgen.',
    thanks: 'Danke für dein Vertrauen in Sanova Capital.'
  },
  advisorClientApproved: {
    subject: 'Kunden-KYC genehmigt: {clientName}',
    body: 'Dein Kunde {clientName} ({clientEmail}) hat das KYC abgeschlossen und wurde genehmigt. Er/sie kann jetzt im Marketplace agieren.'
  },
  advisorClientPurchase: {
    subject: 'Kauf deines Kunden: {clientName}',
    body: '{clientName} ({clientEmail}) hat Tokens im Projekt „{project}“ für USD {amount} gekauft. Provisionen werden gemäß der aktuellen Richtlinie berechnet.'
  },
  invite: {
    investorSubject: 'Sanova Global-Einladung — Investor',
    teamSubject: 'Sanova Global-Einladung — {roleLabel}',
    greeting: 'Hallo{name},',
    investorBody:
      'Du wurdest eingeladen, in tokenisierte Vermögenswerte von Sanova Global zu investieren. Um die Einladung anzunehmen und deine KYC-Prüfung zu starten, öffne diesen Link:',
    teamBody:
      'Du wurdest eingeladen, Sanova Global als {roleLabel} beizutreten. Um die Einladung anzunehmen und mit der KYC-Prüfung fortzufahren, öffne diesen Link:',
    reminderPrefix: 'Erinnerung: ',
    cta: 'Einladung annehmen',
    expiry: 'Dieser Link läuft in 7 Tagen ab.',
    ignore: 'Wenn du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.',
    roleAdvisor: 'Berater',
    roleAdvisorManager: 'Manager'
  }
};
