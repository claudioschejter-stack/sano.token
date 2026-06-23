import type { Metadata } from 'next';
import { NosotrosPage } from '../../../components/landing/NosotrosPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import { getSiteUrl } from '../../../lib/seo/siteUrl';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/nosotros');
  return {
    ...base,
    title: 'Nosotros | Sanova Global',
    description:
      'Conocé al equipo de Sanova Global SAS. Tokenizamos activos reales de Vaca Muerta en Base blockchain para inversores globales.'
  };
}

function NosotrosJsonLd({ siteUrl }: { siteUrl: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: `${siteUrl}/nosotros`,
    name: 'Nosotros — Sanova Global',
    description:
      'Equipo fundador y misión de Sanova Global SAS, empresa argentina de tokenización de activos reales (RWA) en Vaca Muerta.',
    about: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Sanova Global SAS',
      legalName: 'Sanova Global SAS',
      foundingDate: '2024',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'AR',
        addressRegion: 'Neuquén'
      },
      sameAs: [
        siteUrl,
        'https://www.linkedin.com/company/sanova-global'
      ]
    }
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function NosotrosPageRoute() {
  const siteUrl = getSiteUrl();
  return (
    <>
      <NosotrosJsonLd siteUrl={siteUrl} />
      <NosotrosPage />
    </>
  );
}
