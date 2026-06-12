export type PrivacySection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  orderedBullets?: string[];
};

export type PrivacyDocument = {
  title: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  intro: string;
  sections: PrivacySection[];
  arcoNote: string;
  backHome: string;
  contactFormPath: string;
};

export type LegalTermsSection = {
  id: string;
  title: string;
  summary: string;
  paragraphs?: string[];
  bullets?: string[];
  orderedBullets?: string[];
};

export type LegalTermsDocument = {
  title: string;
  subtitle: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  intro: string;
  indexTitle: string;
  sections: LegalTermsSection[];
  closingNote: string;
  backHome: string;
  privacyLinkLabel: string;
  contactFormPath: string;
};
