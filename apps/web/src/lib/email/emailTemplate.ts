import { isRtlEmailLocale } from './emailMessages';
import { LEGAL_CONTACT_EMAIL, LEGAL_SITE_URL } from '../legal/legalConfig';

/**
 * Shared HTML shell for every transactional email. Centralizing this improves
 * sender reputation (consistent, non-spammy markup) and lets every email
 * carry a real contact footer, which mailbox providers weigh when scoring
 * "trustworthiness" of a sender.
 */
export function renderEmailShell(input: { locale?: string | null; bodyHtml: string }): string {
  const dir = isRtlEmailLocale(input.locale) ? 'rtl' : 'ltr';
  const align = dir === 'rtl' ? 'right' : 'left';
  const siteUrl = LEGAL_SITE_URL.replace(/\/$/, '');

  return `
    <div dir="${dir}" style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;text-align:${align};max-width:560px;margin:0 auto">
      ${input.bodyHtml}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 16px" />
      <p style="color:#94a3b8;font-size:12px;margin:0 0 4px">
        Sanova Global · <a href="${siteUrl}" style="color:#94a3b8;text-decoration:underline">${siteUrl.replace(/^https?:\/\//, '')}</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin:0">
        <a href="mailto:${LEGAL_CONTACT_EMAIL}" style="color:#94a3b8;text-decoration:underline">${LEGAL_CONTACT_EMAIL}</a>
      </p>
    </div>
  `;
}

export function renderEmailButton(url: string, label: string): string {
  return `
    <p style="margin:24px 0">
      <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700">
        ${label}
      </a>
    </p>
  `;
}
