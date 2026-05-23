import { prisma } from '@sanova/database';

const CONFIG_ID = 'default';

const DEFAULT_WHATSAPP_PHONE = '5492617513426';
const DEFAULT_CONTACT_EMAIL = 'claudioschejter@gmail.com';
const DEFAULT_SITE_URL = 'https://sano-token-web.vercel.app';

export type PublicPlatformConfig = {
  whatsappPhone: string;
  contactEmail: string;
  siteUrl: string;
};

export type PlatformConfigFieldSource = 'database' | 'environment' | 'default';

export type AdminPlatformConfig = PublicPlatformConfig & {
  sources: {
    whatsappPhone: PlatformConfigFieldSource;
    contactEmail: PlatformConfigFieldSource;
    siteUrl: PlatformConfigFieldSource;
  };
};

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function envWhatsappPhone(): string | null {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_PHONE?.trim();
  return raw ? normalizePhone(raw) : null;
}

function envContactEmail(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_CONTACT_TO_EMAIL?.trim() ||
    process.env.CONTACT_TO_EMAIL?.trim() ||
    null;
  return raw || null;
}

function envSiteUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return raw || null;
}

function resolveField<T extends string>(
  dbValue: string | null | undefined,
  envValue: string | null,
  defaultValue: T
): { value: T; source: PlatformConfigFieldSource } {
  if (dbValue?.trim()) {
    return { value: dbValue.trim() as T, source: 'database' };
  }

  if (envValue) {
    return { value: envValue as T, source: 'environment' };
  }

  return { value: defaultValue, source: 'default' };
}

export async function getPublicPlatformConfig(): Promise<PublicPlatformConfig> {
  const row = await prisma.platformConfig.findUnique({ where: { id: CONFIG_ID } });

  const whatsapp = resolveField(
    row?.whatsappPhone ? normalizePhone(row.whatsappPhone) : null,
    envWhatsappPhone(),
    DEFAULT_WHATSAPP_PHONE
  );
  const contact = resolveField(row?.contactEmail, envContactEmail(), DEFAULT_CONTACT_EMAIL);
  const site = resolveField(row?.siteUrl, envSiteUrl(), DEFAULT_SITE_URL);

  return {
    whatsappPhone: whatsapp.value,
    contactEmail: contact.value,
    siteUrl: site.value.replace(/\/$/, '')
  };
}

export async function getAdminPlatformConfig(): Promise<AdminPlatformConfig> {
  const row = await prisma.platformConfig.findUnique({ where: { id: CONFIG_ID } });

  const whatsapp = resolveField(
    row?.whatsappPhone ? normalizePhone(row.whatsappPhone) : null,
    envWhatsappPhone(),
    DEFAULT_WHATSAPP_PHONE
  );
  const contact = resolveField(row?.contactEmail, envContactEmail(), DEFAULT_CONTACT_EMAIL);
  const site = resolveField(row?.siteUrl, envSiteUrl(), DEFAULT_SITE_URL);

  return {
    whatsappPhone: whatsapp.value,
    contactEmail: contact.value,
    siteUrl: site.value.replace(/\/$/, ''),
    sources: {
      whatsappPhone: whatsapp.source,
      contactEmail: contact.source,
      siteUrl: site.source
    }
  };
}

export type UpdatePlatformConfigInput = {
  whatsappPhone?: string;
  contactEmail?: string;
  siteUrl?: string;
};

export function validatePlatformConfigInput(input: UpdatePlatformConfigInput): string | null {
  if (input.whatsappPhone !== undefined) {
    const phone = normalizePhone(input.whatsappPhone);
    if (phone.length < 8 || phone.length > 15) {
      return 'invalid_whatsapp';
    }
  }

  if (input.contactEmail !== undefined) {
    const email = input.contactEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'invalid_email';
    }
  }

  if (input.siteUrl !== undefined) {
    try {
      const url = new URL(input.siteUrl.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return 'invalid_site_url';
      }
    } catch {
      return 'invalid_site_url';
    }
  }

  return null;
}

export async function updatePlatformConfig(
  input: UpdatePlatformConfigInput
): Promise<AdminPlatformConfig> {
  const validationError = validatePlatformConfigInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const data: {
    whatsappPhone?: string;
    contactEmail?: string;
    siteUrl?: string;
  } = {};

  if (input.whatsappPhone !== undefined) {
    data.whatsappPhone = normalizePhone(input.whatsappPhone);
  }

  if (input.contactEmail !== undefined) {
    data.contactEmail = input.contactEmail.trim().toLowerCase();
  }

  if (input.siteUrl !== undefined) {
    data.siteUrl = input.siteUrl.trim().replace(/\/$/, '');
  }

  await prisma.platformConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, ...data },
    update: data
  });

  return getAdminPlatformConfig();
}
