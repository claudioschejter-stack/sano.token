export type EmailMessages = {
  common: {
    brand: string;
    teamSignature: string;
  };
  activation: {
    subject: string;
    intro: string;
    cta: string;
    expiry: string;
  };
  verificationCode: {
    subject: string;
    label: string;
    expiry: string;
    ignore: string;
  };
  passwordReset: {
    subject: string;
    intro: string;
    cta: string;
    expiry: string;
  };
  accountApproved: {
    subject: string;
    greeting: string;
    approvedLine: string;
    accessLine: string;
    cta: string;
    closing: string;
  };
  purchaseConfirmation: {
    subject: string;
    greeting: string;
    receivedLine: string;
    confirmedLine: string;
    projectLabel: string;
    amountLabel: string;
    trackingLine: string;
    thanks: string;
  };
  advisorClientApproved: {
    subject: string;
    body: string;
  };
  advisorClientPurchase: {
    subject: string;
    body: string;
  };
  invite: {
    investorSubject: string;
    teamSubject: string;
    greeting: string;
    investorBody: string;
    teamBody: string;
    reminderPrefix: string;
    cta: string;
    expiry: string;
    ignore: string;
    roleAdvisor: string;
    roleAdvisorManager: string;
  };
};

export type EmailMessagesPatch = {
  [K in keyof EmailMessages]?: Partial<EmailMessages[K]>;
};
