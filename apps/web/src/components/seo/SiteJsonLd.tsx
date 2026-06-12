import { messagesByLocale, type Locale } from '../../i18n';
import { getSiteUrl } from '../../lib/seo/siteUrl';

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
    name: 'Sanova Global SAS',
    url: siteUrl,
    logo: `${siteUrl}/icons/icon-512.png`,
    description: meta.description,
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
    sameAs: [siteUrl]
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: meta.title,
    url: siteUrl,
    description: meta.description,
    inLanguage: ['es', 'en', 'pt', 'fr', 'de', 'zh', 'ar', 'hi', 'ja', 'ru'],
    publisher: { '@type': 'Organization', name: 'Sanova Global SAS' },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/marketplace?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };

  const investmentService = {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    name: 'Sanova Global RWA Platform',
    url: siteUrl,
    description: landing.hero?.subtitle ?? meta.description,
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
