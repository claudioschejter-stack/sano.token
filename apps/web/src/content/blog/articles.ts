export type BlogSection = {
  heading: string;
  paragraphs: string[];
};

export type BlogArticle = {
  slug: string;
  publishedAt: string;
  title: string;
  description: string;
  keywords: string[];
  sections: BlogSection[];
};

const inversionVacaMuertaEs: BlogArticle = {
  slug: 'inversion-vaca-muerta-rwa',
  publishedAt: '2026-06-12',
  title: 'Inversión en Vaca Muerta: RWA tokens e inmuebles tokenizados',
  description:
    'Guía sobre inversión en Vaca Muerta mediante activos reales tokenizados (RWA): inmuebles Neuquén, rentas USDC, tokenización y colocación privada con KYC.',
  keywords: [
    'vaca muerta inversión',
    'RWA tokens Argentina',
    'inmuebles Neuquén',
    'tokenización',
    'real estate tokenizado',
    'rentas USDC'
  ],
  sections: [
    {
      heading: 'Por qué Vaca Muerta atrae capital global',
      paragraphs: [
        'Vaca Muerta es la segunda reserva de gas shale del mundo y un epicentro de producción no convencional. El crecimiento acelerado del sector energético generó un déficit de infraestructura inmobiliaria y comercial en Neuquén y la cuenca.',
        'Para inversores que buscan “vaca muerta inversión” o exposición a activos reales, la tokenización RWA permite participar en colocaciones privadas vinculadas a inmuebles con contratos B2B con operadoras energéticas.'
      ]
    },
    {
      heading: 'Qué son los RWA tokens en Sanova Global',
      paragraphs: [
        'Los tokens RWA representan participación económica en Compartimentos fiduciarios respaldados por activos del mundo real (inmuebles, flujos de alquiler). No son criptomonedas especulativas: están sujetos a KYC, cumplimiento fiduciario y documentación legal.',
        'Las rentas se liquidan en USDC on-chain según la política del activo, con trazabilidad en blockchain y segregación patrimonial por Compartimento.'
      ]
    },
    {
      heading: 'Cómo empezar (colocación privada)',
      paragraphs: [
        'El acceso es restringido: registro, verificación de identidad (KYC) y aprobación fiduciaria. La plataforma Sanova Global conecta inversores calificados con oportunidades de real estate tokenizado en el corredor estratégico de Vaca Muerta.',
        'Esta nota es educativa y no constituye oferta pública ni recomendación de inversión. Consulte los Términos Legales y la Política de Privacidad antes de invertir.'
      ]
    }
  ]
};

const inversionVacaMuertaEn: BlogArticle = {
  slug: 'inversion-vaca-muerta-rwa',
  publishedAt: '2026-06-12',
  title: 'Vaca Muerta Investment: RWA Tokens & Tokenized Real Estate',
  description:
    'Guide to investing in Vaca Muerta through tokenized real-world assets (RWA): Neuquén real estate, USDC income, tokenization and KYC-compliant private placement.',
  keywords: [
    'Vaca Muerta investment',
    'RWA tokens Argentina',
    'Neuquén real estate',
    'tokenization',
    'tokenized real estate',
    'USDC dividends'
  ],
  sections: [
    {
      heading: 'Why Vaca Muerta attracts global capital',
      paragraphs: [
        'Vaca Muerta is the world’s second-largest shale gas reserve and a hub for unconventional production. Rapid energy sector growth created a shortage of commercial and residential infrastructure in Neuquén and the wider basin.',
        'For investors searching “Vaca Muerta investment” or real asset exposure, RWA tokenization enables participation in private placements tied to properties with B2B leases to major energy operators.'
      ]
    },
    {
      heading: 'What RWA tokens are on Sanova Global',
      paragraphs: [
        'RWA tokens represent economic participation in fiduciary compartments backed by real-world assets (real estate, rental cash flows). They are not speculative cryptocurrencies: they require KYC, fiduciary compliance and legal documentation.',
        'Income is settled in on-chain USDC according to each asset’s policy, with blockchain traceability and compartment-level segregation.'
      ]
    },
    {
      heading: 'How to start (private placement)',
      paragraphs: [
        'Access is restricted: registration, identity verification (KYC) and fiduciary approval. The Sanova Global platform connects qualified investors with tokenized real estate opportunities in the Vaca Muerta strategic corridor.',
        'This article is educational and is not a public offering or investment recommendation. Review the Legal Terms and Privacy Policy before investing.'
      ]
    }
  ]
};

const ARTICLES_BY_SLUG: Record<string, { es: BlogArticle; en: BlogArticle }> = {
  'inversion-vaca-muerta-rwa': {
    es: inversionVacaMuertaEs,
    en: inversionVacaMuertaEn
  }
};

export const BLOG_SLUGS = Object.keys(ARTICLES_BY_SLUG);

export function getBlogArticle(slug: string, locale: string): BlogArticle | null {
  const entry = ARTICLES_BY_SLUG[slug];
  if (!entry) {
    return null;
  }
  return locale === 'es' ? entry.es : entry.en;
}

export function listBlogArticles(locale: string): BlogArticle[] {
  return BLOG_SLUGS.map((slug) => getBlogArticle(slug, locale)).filter(
    (article): article is BlogArticle => article !== null
  );
}
