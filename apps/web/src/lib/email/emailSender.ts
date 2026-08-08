/**
 * Who the mail comes from, and who to answer.
 *
 * Both derive from the domain Resend has verified, because a message whose body,
 * footer and reply address point at different domains reads as forged. The login
 * code is the worst place for that: its whole content is a six digit number, so
 * the footer is most of what a filter has to judge, and the recipient's provider
 * is deciding whether to trust a sender it has barely seen before.
 */
export function emailFromAddress(): string {
  return (
    process.env.ONBOARDING_FROM_EMAIL?.trim() ||
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    'Sanova Global <no-reply@sanovacapital.com>'
  );
}

/** The bare address inside `Name <address>`, or the input if it is already bare. */
export function bareEmailAddress(from: string): string {
  const match = /<([^>]+)>/.exec(from);
  return (match?.[1] ?? from).trim();
}

export function emailSenderDomain(from = emailFromAddress()): string | null {
  const address = bareEmailAddress(from);
  const at = address.lastIndexOf('@');
  return at === -1 ? null : address.slice(at + 1).toLowerCase();
}

/**
 * The address shown in the footer and used for replies.
 *
 * It has to live on the sending domain. The footer used to link
 * `legales@sanova.global` while the mail was signed by `sanovacapital.com`, which
 * is a cross-domain contact in a message that is otherwise just a number — the
 * shape of a phishing attempt.
 */
export function emailContactAddress(): string {
  const configured = process.env.EMAIL_CONTACT_ADDRESS?.trim();
  if (configured) {
    return configured;
  }
  const domain = emailSenderDomain();
  return domain ? `info@${domain}` : 'info@sanovacapital.com';
}
