export const CONTACT_TO_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_TO_EMAIL?.trim() || 'claudioschejter@gmail.com';

export const CONTACT_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://sano-token-web.vercel.app';

export const FORM_SUBMIT_ACTION = `https://formsubmit.co/${encodeURIComponent(CONTACT_TO_EMAIL)}`;

export const CONTACT_SUCCESS_PATH = '/contacto?enviado=1';
