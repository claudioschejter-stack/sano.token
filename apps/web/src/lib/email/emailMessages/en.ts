import type { EmailMessages } from './types';

/**
 * Canonical English copy for all transactional emails — every other locale file
 * is a partial patch deep-merged onto this one (see `mergeEmailLocale.ts`), so a
 * missing key in any locale always falls back to English instead of breaking.
 */
export const en: EmailMessages = {
  common: {
    brand: 'Sanova Global',
    teamSignature: 'The Sanova Global team'
  },
  activation: {
    subject: 'Activate your account — Sanova Global',
    intro: 'Thanks for signing up with Sanova Global.',
    cta: 'Activate your account',
    expiry: 'This link expires in 24 hours. If you did not create this account, you can ignore this message.'
  },
  verificationCode: {
    subject: 'Your Sanova Global verification code',
    label: 'Your Sanova verification code is:',
    expiry: 'This code expires in 10 minutes.',
    ignore: "If you didn't request this, you can safely ignore this message."
  },
  passwordReset: {
    subject: 'Reset your password — Sanova Global',
    intro: 'We received a request to reset the password for your Sanova account.',
    cta: 'Reset password',
    expiry: "This link expires in 1 hour. If you didn't request this change, you can ignore this message."
  },
  accountApproved: {
    subject: 'Your Sanova Capital account has been approved!',
    greeting: 'Hello {name},',
    approvedLine: 'Your identity verification (KYC) has been approved and your account is ready.',
    accessLine: 'You can now access the platform and start investing in the Sanova Capital marketplace.',
    cta: 'Go to platform',
    closing: 'Best regards,'
  },
  purchaseConfirmation: {
    subject: 'Investment confirmation: {project}',
    greeting: 'Hello {name},',
    receivedLine: 'We have received your investment of USD {amount} in the project "{project}".',
    confirmedLine: 'We have confirmed your investment on the platform.',
    projectLabel: 'Project:',
    amountLabel: 'Amount invested:',
    trackingLine: 'You can track your assets and returns from your account dashboard.',
    thanks: 'Thank you for trusting Sanova Capital.'
  },
  advisorClientApproved: {
    subject: 'Client KYC approved: {clientName}',
    body: 'Your client {clientName} ({clientEmail}) completed KYC and was approved. They can now operate on the marketplace.'
  },
  advisorClientPurchase: {
    subject: 'Purchase from your client: {clientName}',
    body: '{clientName} ({clientEmail}) purchased tokens in "{project}" for USD {amount}. Commissions accrue according to the current policy.'
  },
  invite: {
    investorSubject: 'Sanova Global Invitation — Investor',
    teamSubject: 'Sanova Global Invitation — {roleLabel}',
    greeting: 'Hello{name},',
    investorBody:
      'You were invited to invest in tokenized assets with Sanova Global. To accept the invitation and start your KYC verification, open this link:',
    teamBody:
      'You were invited to join Sanova Global as {roleLabel}. To accept the invitation and continue with KYC verification, open this link:',
    reminderPrefix: 'Reminder: ',
    cta: 'Accept invitation',
    expiry: 'This link expires in 7 days.',
    ignore: "If you weren't expecting this email, you can ignore it.",
    roleAdvisor: 'Advisor',
    roleAdvisorManager: 'Manager'
  }
};
