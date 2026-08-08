import { emailContactAddress, emailFromAddress } from './emailSender';

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
   * The cost of a filter's wrong guess is asymmetric: a promotional message in
   * spam is a lost impression, a second factor in spam is a locked account.
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

  const from = emailFromAddress();
  /**
   * Reply to an address someone reads, not to `no-reply`.
   *
   * A reply address that bounces is a small negative on its own, and it also
   * throws away the one channel an investor reaches for when the code does not
   * arrive — which is exactly the situation this is meant to survive.
   */
  const replyTo = process.env.CONTACT_FROM_EMAIL?.trim() || emailContactAddress();

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
        reply_to: replyTo,
        subject: input.subject,
        text: input.text,
        html: input.html.includes('<') ? input.html : `<p>${escapeHtml(input.html)}</p>`,
        /**
         * `Auto-Submitted` says this was generated in response to something the
         * recipient just did, which is what separates a login code from a
         * newsletter.
         *
         * Two headers are deliberately absent. `List-Unsubscribe` marks bulk mail,
         * and nobody unsubscribes from their own login code. `X-Priority: 1` is
         * worse than useless: legitimate senders rarely set it and spammers
         * routinely do, so it costs reputation instead of buying urgency.
         */
        headers: { 'Auto-Submitted': 'auto-generated' }
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
