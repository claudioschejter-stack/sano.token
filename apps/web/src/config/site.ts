/** Digits only, with country code. Override via NEXT_PUBLIC_WHATSAPP_PHONE in Vercel / .env.local */
const DEFAULT_WHATSAPP_PHONE = '5492617513426';

export function getWhatsAppPhone(): string {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? DEFAULT_WHATSAPP_PHONE;
  return raw.replace(/\D/g, '');
}

export function getWhatsAppUrl(message: string, phoneOverride?: string): string | null {
  const phone = (phoneOverride ?? getWhatsAppPhone()).replace(/\D/g, '');
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
