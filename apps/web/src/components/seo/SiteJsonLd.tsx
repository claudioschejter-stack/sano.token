import { messagesByLocale, type Locale } from '../../i18n';
import { getSiteUrl } from '../../lib/seo/siteUrl';
import { getLinkedInUrl, getYouTubeUrl } from '../../config/social';

type SiteJsonLdProps = {
  locale: Locale;
};

export function SiteJsonLd({ locale }: SiteJsonLdProps) {
  const siteUrl = getSiteUrl();
  const meta = messagesByLocale[locale].meta;
  const landing = messagesByLocale[locale].landing;

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: 'Sanova Global SAS',
    legalName: 'Sanova Global SAS',
    foundingDate: '2024',
    url: siteUrl,
    logo: `${siteUrl}/icons/icon-512.png`,
    description: meta.description,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'AR',
      addressRegion: 'Neuquén'
    },
    areaServed: 'Worldwide',
    knowsAbout: [
      'Real World Assets',
      'RWA tokens',
      'Tokenized real estate',
      'Vaca Muerta',
      'Shale oil and gas infrastructure',
      'Private placement',
      'USDC dividends'
    ],
    sameAs: [
      siteUrl,
      getLinkedInUrl(),
      getYouTubeUrl()
    ]
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: meta.title,
    url: siteUrl,
    description: meta.description,
    inLanguage: ['es', 'en', 'pt', 'fr', 'de', 'zh', 'ar', 'hi', 'ja', 'ru', 'bn', 'ur', 'id', 'sw', 'mr'],
    publisher: { '@type': 'Organization', '@id': `${siteUrl}/#organization`, name: 'Sanova Global SAS' },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/marketplace?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };

  const investmentService = {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    '@id': `${siteUrl}/#service`,
    name: 'Sanova Global RWA Platform',
    url: siteUrl,
    description: landing.hero?.subtitle ?? meta.description,
    provider: { '@type': 'Organization', '@id': `${siteUrl}/#organization` },
    areaServed: {
      '@type': 'Place',
      name: 'Vaca Muerta, Neuquén, Argentina'
    },
    serviceType: 'Tokenized real estate private placement'
  };

  const payload = [organization, website, investmentService];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
