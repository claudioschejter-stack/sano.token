import type { Metadata } from 'next';
import { PrivacyPolicyPage } from '../../../components/landing/PrivacyPolicyPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import { messagesByLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/privacidad');
  const m = messagesByLocale[locale].legalPagesMeta;
  return {
    ...base,
    title: m.privacyTitle,
    description: m.privacyDescription,
    robots: { index: false, follow: false }
  };
}

export default function PrivacidadPage() {
  return <PrivacyPolicyPage />;
}
