function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type TransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /**
   * Marks the message as transactional rather than bulk.
   *
   * A login code with no such marking looks like any other automated mail to a
   * filter, and the cost of the wrong guess is asymmetric: a promotional message
   * in spam is a lost impression, a second factor in spam is a locked account.
   */
  category?: 'auth' | 'notification';
};

type SendResult = { ok: boolean; error?: string };

export async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY missing — skipping send to', input.to);
    return { ok: false, error: 'RESEND_NOT_CONFIGURED' };
  }

  const from =
    process.env.ONBOARDING_FROM_EMAIL?.trim() ||
    process.env.CONTACT_FROM_EMAIL?.trim() ||
    'Sanova Global <no-reply@sanovacapital.com>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        reply_to: process.env.CONTACT_FROM_EMAIL?.trim() || from,
        subject: input.subject,
        text: input.text,
        html: input.html.includes('<') ? input.html : `<p>${escapeHtml(input.html)}</p>`,
        /**
         * `Auto-Submitted` and a high priority tell filters this was generated in
         * response to something the recipient just did, which is what separates a
         * login code from a newsletter. Deliberately no `List-Unsubscribe`: on a
         * transactional message it signals bulk, which is the opposite.
         */
        headers:
          input.category === 'auth'
            ? { 'Auto-Submitted': 'auto-generated', 'X-Priority': '1' }
            : { 'Auto-Submitted': 'auto-generated' }
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[email] Resend error', response.status, body);
      return { ok: false, error: `RESEND_${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    console.error('[email] Resend fetch failed', error);
    return { ok: false, error: 'RESEND_NETWORK_ERROR' };
  }
}
