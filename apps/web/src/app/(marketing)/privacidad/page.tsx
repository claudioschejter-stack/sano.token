import type { Metadata } from 'next';
import { PrivacyPolicyPage } from '../../../components/landing/PrivacyPolicyPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/privacidad');
  return {
    ...base,
    title: 'Política de Privacidad | Sanova Global',
    description:
      'Política de Privacidad de Sanova Global SAS. Fideicomiso Sanova Global RWA, Compartimentos, KYC/AML, Ley 25.326 y tratamiento de datos Web3.',
    robots: { index: false, follow: false }
  };
}

export default function PrivacidadPage() {
  return <PrivacyPolicyPage />;
}
