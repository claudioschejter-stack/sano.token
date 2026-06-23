import type { Metadata } from 'next';
import { LegalTerms } from '../../../components/landing/LegalTerms';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/terminos');
  return {
    ...base,
    title: 'Términos Legales | Sanova Global',
    description:
      'Términos Legales y Condiciones de Uso de Sanova Global SAS. Fideicomiso Sanova Global RWA, Compartimentos, colocación privada, whitelist, activos internacionales y bóvedas ERC-4626 (Base).',
    robots: { index: false, follow: false }
  };
}

export default function TerminosPage() {
  return <LegalTerms />;
}
