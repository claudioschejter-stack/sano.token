export type PickedContact = {
  name: string;
  tel: string;
  email: string;
};

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildWhatsAppInviteUrl(phone: string, message: string): string {
  const digits = normalizePhoneDigits(phone);
  if (!digits) {
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildInvestorInviteWhatsAppMessage(input: {
  acceptUrl: string;
  name?: string | null;
}): string {
  const greeting = input.name?.trim() ? `Hola ${input.name.trim()},` : 'Hola,';
  return [
    greeting,
    '',
    'Te invito a invertir en activos tokenizados de Sanova Global.',
    'Aceptá la invitación y completá tu verificación KYC:',
    input.acceptUrl,
    '',
    'El enlace vence en 7 días.',
    'Sanova Global'
  ].join('\n');
}

export function buildTeamInviteWhatsAppMessage(input: {
  acceptUrl: string;
  roleLabel: string;
  name?: string | null;
}): string {
  const greeting = input.name?.trim() ? `Hola ${input.name.trim()},` : 'Hola,';
  return [
    greeting,
    '',
    `Te invito a unirte a Sanova Global como ${input.roleLabel}.`,
    'Aceptá la invitación para continuar con KYC:',
    input.acceptUrl,
    '',
    'El enlace vence en 7 días.',
    'Sanova Global'
  ].join('\n');
}

export function isContactPickerAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && Boolean(navigator.contacts?.select);
}

/** Pick contacts from the device (Chrome Android / supported browsers). */
export async function pickDeviceContacts(): Promise<PickedContact[]> {
  if (!isContactPickerAvailable()) {
    throw new Error('CONTACT_PICKER_UNAVAILABLE');
  }

  const contacts = await navigator.contacts!.select(['name', 'tel', 'email'], { multiple: true });
  const rows: PickedContact[] = [];

  for (const contact of contacts) {
    const tel = contact.tel?.[0] ?? '';
    const email = contact.email?.[0] ?? '';
    const name = contact.name?.[0] ?? '';
    if (!tel && !email) {
      continue;
    }
    rows.push({ name, tel, email });
  }

  return rows;
}

export function openWhatsAppInvite(phone: string, message: string): void {
  const url = buildWhatsAppInviteUrl(phone, message);
  window.open(url, '_blank', 'noopener,noreferrer');
}
