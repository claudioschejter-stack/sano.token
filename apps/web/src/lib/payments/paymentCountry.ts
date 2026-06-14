import { prisma } from '@sanova/database';

/** ISO 3166-1 alpha-2 countries blocked for fiat rails (sanctions / policy). */
export const PAYMENT_SANCTIONED_COUNTRIES = new Set(
  (process.env.PAYMENT_SANCTIONED_COUNTRIES ?? 'RU,BY,IR,SY,CU,VE,MM,KP,SD').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
);

export function normalizePaymentCountry(country?: string | null): string {
  const normalized = country?.trim().toUpperCase();
  if (!normalized || normalized.length !== 2) {
    return 'AR';
  }
  if (normalized === 'EU') {
    return 'EU';
  }
  return normalized;
}

export function isPaymentCountrySanctioned(country?: string | null): boolean {
  return PAYMENT_SANCTIONED_COUNTRIES.has(normalizePaymentCountry(country));
}

export async function resolvePaymentCountryForUser(userId: string, hint?: string | null): Promise<string> {
  if (hint?.trim()) {
    return normalizePaymentCountry(hint);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { jurisdiction: true }
  });

  return normalizePaymentCountry(user?.jurisdiction);
}
