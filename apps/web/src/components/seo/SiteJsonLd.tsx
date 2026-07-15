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
    '@type': ['Organization', 'FinancialService'],
    '@id': `${siteUrl}/#organization`,
    name: 'Sanova Global SAS',
    legalName: 'Sanova Global SAS',
    alternateName: ['Sanova', 'Sanova Global', 'Sanova RWA', 'Sanova Capital', 'Token Vaca Muerta'],
    foundingDate: '2024',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/icons/icon-512.png`,
      width: 512,
      height: 512
    },
    image: `${siteUrl}/opengraph-image`,
    description: meta.description,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'AR',
      addressRegion: 'Neuquén',
      addressLocality: 'Vaca Muerta'
    },
    areaServed: 'Worldwide',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Tokenized Real Asset Services',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Real Estate Tokenization' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'RWA Investment' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'DeFi Yield Products' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Private Placement' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Tokenized Asset Management' } }
      ]
    },
    knowsAbout: [
      'Real World Assets',
      'RWA tokens',
      'Tokenized real estate',
      'Vaca Muerta',
      'Añelo',
      'Shale oil and gas infrastructure',
      'Private placement',
      'USDC dividends',
      'Rental income and profitability',
      'ERC-4626 tokens',
      'Morpho DeFi protocol',
      'Base blockchain'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: `${siteUrl}/contacto`,
      availableLanguage: ['Spanish', 'English', 'Portuguese', 'German', 'French', 'Arabic', 'Chinese', 'Japanese', 'Russian', 'Hindi']
    },
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

  // Using @type Service (not FinancialService) so that `provider` and service-level
  // properties are schema.org-valid. FinancialService extends LocalBusiness, not Service.
  const investmentService = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${siteUrl}/#service`,
    name: 'Sanova Global RWA Platform',
    url: siteUrl,
    description: landing.hero?.subtitle ?? meta.description,
    provider: { '@type': 'Organization', '@id': `${siteUrl}/#organization` },
    areaServed: {
      '@type': 'Place',
      name: 'Vaca Muerta, Neuquén, Argentina'
    },
    category: 'Real Estate Tokenization, RWA Investment, DeFi Yield, Private Placement'
  };

  const payload = [organization, website, investmentService];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
