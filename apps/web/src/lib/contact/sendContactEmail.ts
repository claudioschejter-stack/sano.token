import { getPublicPlatformConfig } from '../platform/platformConfigService';

const DEFAULT_TO = 'claudioschejter@gmail.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendViaResend(
  to: string,
  name: string,
  email: string,
  message: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from =
    process.env.CONTACT_FROM_EMAIL?.trim() || 'Sanova Global <onboarding@resend.dev>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `[Sanova Contacto] ${name}`,
      text: `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`,
      html: `<p><strong>Nombre:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Mensaje:</strong></p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`
    })
  });

  return response.ok;
}

export async function sendContactEmail(
  name: string,
  email: string,
  message: string
): Promise<boolean> {
  const config = await getPublicPlatformConfig();
  const to = config.contactEmail || process.env.CONTACT_TO_EMAIL?.trim() || DEFAULT_TO;
  return sendViaResend(to, name, email, message);
}
