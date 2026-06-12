import { LEGAL_CONTACT_PATH, LEGAL_SITE_URL } from '../../lib/legal/legalConfig';
import type { LegalTermsDocument, PrivacyDocument } from './types';

/** Fix common auto-translation mistakes in legal markdown links and site URL. */
export function sanitizeLegalMarkdown(text: string): string {
  return text
    .replace(/\]\(\/contact\)/gi, `](${LEGAL_CONTACT_PATH})`)
    .replace(/\]\(\/privacy\)/gi, '](/privacidad)')
    .replace(/https:\/\/sano-token-web\.vercel\.app/g, LEGAL_SITE_URL);
}

export function sanitizePrivacyDocument(document: PrivacyDocument): PrivacyDocument {
  return {
    ...document,
    intro: sanitizeLegalMarkdown(document.intro),
    arcoNote: sanitizeLegalMarkdown(document.arcoNote)
  };
}

export function sanitizeLegalTermsDocument(document: LegalTermsDocument): LegalTermsDocument {
  return {
    ...document,
    intro: sanitizeLegalMarkdown(document.intro),
    closingNote: sanitizeLegalMarkdown(document.closingNote)
  };
}
