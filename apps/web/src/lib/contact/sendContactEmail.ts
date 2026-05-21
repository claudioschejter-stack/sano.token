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

async function sendViaFormSubmit(
  to: string,
  name: string,
  email: string,
  message: string
): Promise<boolean> {
  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      name,
      email,
      message,
      _replyto: email,
      _subject: `[Sanova Contacto] ${name}`,
      _captcha: 'false',
      _template: 'table'
    })
  });

  if (!response.ok) return false;

  try {
    const data = (await response.json()) as { success?: string | boolean };
    return data.success === 'true' || data.success === true;
  } catch {
    return true;
  }
}

export async function sendContactEmail(
  name: string,
  email: string,
  message: string
): Promise<boolean> {
  const to = process.env.CONTACT_TO_EMAIL?.trim() || DEFAULT_TO;

  if (await sendViaResend(to, name, email, message)) {
    return true;
  }

  return sendViaFormSubmit(to, name, email, message);
}
