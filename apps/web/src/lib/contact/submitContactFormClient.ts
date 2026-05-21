const CONTACT_TO =
  process.env.NEXT_PUBLIC_CONTACT_TO_EMAIL?.trim() || 'claudioschejter@gmail.com';

/** FormSubmit only accepts submissions from the browser, not from Vercel/serverless. */
export async function submitContactFormClient(
  name: string,
  email: string,
  message: string
): Promise<boolean> {
  const response = await fetch(
    `https://formsubmit.co/ajax/${encodeURIComponent(CONTACT_TO)}`,
    {
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
    }
  );

  if (!response.ok) return false;

  const data = (await response.json()) as { success?: string | boolean };
  return data.success === 'true' || data.success === true;
}
