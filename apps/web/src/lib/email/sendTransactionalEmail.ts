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
    'Sanova Global <onboarding@resend.dev>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html.includes('<') ? input.html : `<p>${escapeHtml(input.html)}</p>`
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[email] Resend error', response.status, body);
    return { ok: false, error: `RESEND_${response.status}` };
  }

  return { ok: true };
}
