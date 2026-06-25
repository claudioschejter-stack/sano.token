import type { Metadata } from 'next';
import { NosotrosPage } from '../../../components/landing/NosotrosPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import { getSiteUrl } from '../../../lib/seo/siteUrl';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/nosotros');
  const isEs = locale === 'es';

  // fix: 2 per-page og:title and og:description
  // fix: 7 use title.absolute to prevent template appending a second "| Sanova Global"
  // fix: 8 per-page meta keywords
  const ogTitle = isEs
    ? 'El equipo de Sanova Global | RWA Tokenización Vaca Muerta'
    : 'The Sanova Global Team | RWA Tokenization Vaca Muerta';
  const ogDescription = isEs
    ? 'Conocé al equipo detrás de Sanova Global SAS. Tokenizamos activos reales en Vaca Muerta sobre Base blockchain para inversores globales.'
    : 'Meet the team behind Sanova Global SAS. We tokenize real-world assets in Vaca Muerta on Base blockchain for global investors.';

  return {
    ...base,
    title: { absolute: ogTitle },
    description: ogDescription,
    keywords: isEs
      ? ['equipo Sanova Global', 'tokenización RWA Argentina', 'blockchain Vaca Muerta', 'inversión real estate Argentina', 'ERC-4626', 'fideicomiso Ley 24441']
      : ['Sanova Global team', 'RWA tokenization Argentina', 'Vaca Muerta blockchain', 'real estate investment Argentina', 'ERC-4626', 'trust Law 24441'],
    openGraph: {
      ...base.openGraph,
      title: ogTitle,
      description: ogDescription,
      url: `${getSiteUrl()}/nosotros`
    },
    twitter: {
      ...base.twitter,
      title: ogTitle,
      description: ogDescription
    },
    alternates: {
      ...base.alternates,
      canonical: `${getSiteUrl()}/nosotros`
    }
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
