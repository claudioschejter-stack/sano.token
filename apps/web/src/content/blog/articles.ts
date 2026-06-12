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

const vacaMuertaTokenizacionEs: BlogArticle = {
  slug: 'vaca-muerta-tokenizacion',
  publishedAt: '2026-06-12',
  title: 'Vaca Muerta tokenización: activos reales on-chain con KYC',
  description:
    'Qué es la tokenización en Vaca Muerta: inmuebles y flujos B2B convertidos en tokens RWA, rentas USDC, segregación fiduciaria y colocación privada en Neuquén.',
  keywords: [
    'Vaca Muerta tokenización',
    'tokenización activos reales',
    'RWA Argentina',
    'tokens RWA',
    'inmuebles Neuquén',
    'rentas USDC'
  ],
  sections: [
    {
      heading: 'Tokenización en el corredor de Vaca Muerta',
      paragraphs: [
        'La tokenización en Vaca Muerta permite representar participación económica en inmuebles estratégicos y contratos de alquiler B2B con operadoras energéticas mediante tokens RWA on-chain.',
        'A diferencia de criptoactivos especulativos, estos tokens están respaldados por activos del mundo real, documentación legal y Compartimentos fiduciarios con segregación patrimonial.'
      ]
    },
    {
      heading: 'Beneficios para inversores calificados',
      paragraphs: [
        'Acceso a exposición shale e infraestructura inmobiliaria en Neuquén con liquidación de rentas en USDC, trazabilidad blockchain y cumplimiento KYC.',
        'Sanova Global opera colocaciones privadas: el registro, verificación de identidad y aprobación fiduciaria son requisitos previos al acceso.'
      ]
    },
    {
      heading: 'Marco regulatorio y disclaimer',
      paragraphs: [
        'La tokenización no implica oferta pública. Cada activo tiene prospecto, política de distribución y restricciones de transferencia según normativa aplicable.',
        'Este contenido es educativo. Consulte Términos Legales y Política de Privacidad antes de invertir.'
      ]
    }
  ]
};

const vacaMuertaTokenizacionEn: BlogArticle = {
  slug: 'vaca-muerta-tokenizacion',
  publishedAt: '2026-06-12',
  title: 'Vaca Muerta Tokenization: On-Chain Real Assets with KYC',
  description:
    'What tokenization means in Vaca Muerta: real estate and B2B cash flows as RWA tokens, USDC income, fiduciary segregation and private placement in Neuquén.',
  keywords: [
    'Vaca Muerta tokenization',
    'real asset tokenization',
    'RWA Argentina',
    'RWA tokens',
    'Neuquén real estate',
    'USDC dividends'
  ],
  sections: [
    {
      heading: 'Tokenization in the Vaca Muerta corridor',
      paragraphs: [
        'Tokenization in Vaca Muerta represents economic participation in strategic properties and B2B leases with energy operators through on-chain RWA tokens.',
        'Unlike speculative crypto assets, these tokens are backed by real-world assets, legal documentation and fiduciary compartments with asset segregation.'
      ]
    },
    {
      heading: 'Benefits for qualified investors',
      paragraphs: [
        'Access shale and real estate infrastructure exposure in Neuquén with USDC income settlement, blockchain traceability and KYC compliance.',
        'Sanova Global runs private placements: registration, identity verification and fiduciary approval are required before access.'
      ]
    },
    {
      heading: 'Regulatory framework and disclaimer',
      paragraphs: [
        'Tokenization does not constitute a public offering. Each asset has a prospectus, distribution policy and transfer restrictions under applicable rules.',
        'This content is educational. Review the Legal Terms and Privacy Policy before investing.'
      ]
    }
  ]
};

const inmueblesNeuquenEs: BlogArticle = {
  slug: 'inmuebles-neuquen',
  publishedAt: '2026-06-12',
  title: 'Inmuebles Neuquén: inversión inmobiliaria en Vaca Muerta',
  description:
    'Oportunidades en inmuebles Neuquén vinculados al shale: oficinas, housing y comercial con contratos B2B, tokenización RWA y rentas en moneda dura.',
  keywords: [
    'inmuebles Neuquén',
    'inversión inmobiliaria Neuquén',
    'Vaca Muerta inmuebles',
    'real estate Neuquén',
    'RWA Argentina',
    'rentas USDC'
  ],
  sections: [
    {
      heading: 'Demanda inmobiliaria en la cuenca',
      paragraphs: [
        'El boom del shale en Vaca Muerta generó déficit de inmuebles en Neuquén y localidades del corredor: oficinas corporativas, housing para personal y espacios comerciales con contratos largos.',
        'Los inversores que buscan inmuebles Neuquén con flujo predecible pueden acceder vía colocación privada tokenizada, sin comprar físicamente la propiedad.'
      ]
    },
    {
      heading: 'Contratos B2B con operadoras',
      paragraphs: [
        'Los activos en la plataforma Sanova Global priorizan inmuebles con arrendamiento a operadoras energéticas y empresas de servicios del sector.',
        'Esa vinculación con la inversión shale Argentina reduce vacancia y alinea rentas con la actividad productiva de la cuenca.'
      ]
    },
    {
      heading: 'Cómo participar',
      paragraphs: [
        'Complete KYC, revise documentación del Compartimento y reserve tokens en colocación privada. Las distribuciones se liquidan según política del activo, habitualmente en USDC on-chain.',
        'No es oferta pública. Material educativo; consulte asesor legal y financiero según su jurisdicción.'
      ]
    }
  ]
};

const inmueblesNeuquenEn: BlogArticle = {
  slug: 'inmuebles-neuquen',
  publishedAt: '2026-06-12',
  title: 'Neuquén Real Estate: Property Investment in Vaca Muerta',
  description:
    'Neuquén property opportunities tied to shale: offices, housing and commercial assets with B2B leases, RWA tokenization and hard-currency income.',
  keywords: [
    'Neuquén real estate',
    'Neuquén property investment',
    'Vaca Muerta real estate',
    'Argentina real estate',
    'RWA Argentina',
    'USDC dividends'
  ],
  sections: [
    {
      heading: 'Real estate demand in the basin',
      paragraphs: [
        'Shale growth in Vaca Muerta created a shortage of properties in Neuquén and corridor towns: corporate offices, workforce housing and commercial space with long-term leases.',
        'Investors seeking Neuquén real estate with predictable cash flow can access private tokenized placements without buying the physical asset outright.'
      ]
    },
    {
      heading: 'B2B leases with operators',
      paragraphs: [
        'Assets on the Sanova Global platform prioritize properties leased to energy operators and oil & gas service companies.',
        'That link to Argentina shale investment reduces vacancy and aligns rents with productive activity in the basin.'
      ]
    },
    {
      heading: 'How to participate',
      paragraphs: [
        'Complete KYC, review compartment documentation and reserve tokens in a private placement. Distributions are settled per asset policy, typically in on-chain USDC.',
        'Not a public offering. Educational material; seek legal and financial advice according to your jurisdiction.'
      ]
    }
  ]
};

const rwaArgentinaEs: BlogArticle = {
  slug: 'rwa-argentina',
  publishedAt: '2026-06-12',
  title: 'RWA Argentina: activos reales tokenizados y cumplimiento',
  description:
    'Guía RWA Argentina: qué son los Real World Assets tokenizados, fiducia, KYC, Neuquén y Vaca Muerta como caso de uso para inversores globales.',
  keywords: [
    'RWA Argentina',
    'activos reales tokenizados',
    'real world assets Argentina',
    'tokens RWA',
    'Vaca Muerta tokenización',
    'inversión Argentina'
  ],
  sections: [
    {
      heading: 'Qué son los RWA en Argentina',
      paragraphs: [
        'Los Real World Assets (RWA) son representaciones digitales de activos tangibles: inmuebles, flujos de alquiler o derechos económicos respaldados por estructura legal local.',
        'En Argentina, el ecosistema RWA crece en sectores con demanda estructural — energía shale, infraestructura y real estate regional — con foco en cumplimiento y trazabilidad.'
      ]
    },
    {
      heading: 'Vaca Muerta como hub RWA',
      paragraphs: [
        'Vaca Muerta concentra capital extranjero y necesidades de inmuebles Neuquén. La tokenización permite fraccionar participación económica y liquidar rentas en USDC con registro on-chain.',
        'Sanova Global conecta inversores calificados con Compartimentos fiduciarios dedicados a activos del corredor estratégico.'
      ]
    },
    {
      heading: 'Riesgos y acceso restringido',
      paragraphs: [
        'Los RWA no eliminan riesgo de mercado, operativo o regulatorio. El acceso es privado, con KYC y restricciones de transferencia.',
        'Contenido informativo. No constituye oferta ni asesoramiento. Revise Términos y Privacidad.'
      ]
    }
  ]
};

const rwaArgentinaEn: BlogArticle = {
  slug: 'rwa-argentina',
  publishedAt: '2026-06-12',
  title: 'RWA Argentina: Tokenized Real Assets & Compliance',
  description:
    'RWA Argentina guide: what tokenized Real World Assets are, fiduciary structures, KYC, Neuquén and Vaca Muerta as a use case for global investors.',
  keywords: [
    'RWA Argentina',
    'tokenized real assets',
    'real world assets Argentina',
    'RWA tokens',
    'Vaca Muerta tokenization',
    'Argentina investment'
  ],
  sections: [
    {
      heading: 'What RWA means in Argentina',
      paragraphs: [
        'Real World Assets (RWA) are digital representations of tangible assets: real estate, rental cash flows or economic rights backed by local legal structure.',
        'In Argentina, the RWA ecosystem grows in sectors with structural demand — shale energy, infrastructure and regional real estate — with emphasis on compliance and traceability.'
      ]
    },
    {
      heading: 'Vaca Muerta as an RWA hub',
      paragraphs: [
        'Vaca Muerta attracts foreign capital and Neuquén property demand. Tokenization enables fractional economic participation and USDC income settlement with on-chain records.',
        'Sanova Global connects qualified investors with fiduciary compartments dedicated to assets in the strategic corridor.'
      ]
    },
    {
      heading: 'Risks and restricted access',
      paragraphs: [
        'RWA tokens do not remove market, operational or regulatory risk. Access is private, with KYC and transfer restrictions.',
        'Informational content. Not an offering or advice. Review Legal Terms and Privacy Policy.'
      ]
    }
  ]
};

const inversionShaleEs: BlogArticle = {
  slug: 'inversion-shale-argentina',
  publishedAt: '2026-06-12',
  title: 'Inversión shale Argentina: infraestructura y rentas tokenizadas',
  description:
    'Inversión shale Argentina más allá del pozo: infraestructura inmobiliaria en Vaca Muerta, inmuebles Neuquén, tokens RWA y dividendos USDC para inversores calificados.',
  keywords: [
    'inversión shale Argentina',
    'shale Argentina',
    'Vaca Muerta inversión',
    'infraestructura shale',
    'RWA Argentina',
    'inmuebles Neuquén'
  ],
  sections: [
    {
      heading: 'Shale y demanda de infraestructura',
      paragraphs: [
        'La inversión shale Argentina en producción convencional y no convencional impulsa oficinas, logística, housing y servicios en Neuquén y la cuenca.',
        'Quienes buscan exposición al sector sin operar yacimientos pueden considerar real estate tokenizado con contratos B2B ligados a la actividad energética.'
      ]
    },
    {
      heading: 'Rentas en moneda dura vía RWA',
      paragraphs: [
        'Los tokens RWA en Sanova Global liquidan distribuciones según política del activo, con USDC on-chain y segregación por Compartimento fiduciario.',
        'El modelo combina inversión shale Argentina (demanda derivada) con tokenización y cumplimiento KYC para colocación privada.'
      ]
    },
    {
      heading: 'Proceso de acceso',
      paragraphs: [
        'Registro en la plataforma, verificación de identidad y revisión de documentación del activo. Solo inversores que cumplan criterios de colocación privada.',
        'Educacional. No es recomendación de inversión ni oferta pública.'
      ]
    }
  ]
};

const inversionShaleEn: BlogArticle = {
  slug: 'inversion-shale-argentina',
  publishedAt: '2026-06-12',
  title: 'Argentina Shale Investment: Infrastructure & Tokenized Income',
  description:
    'Argentina shale investment beyond the wellhead: Vaca Muerta real estate infrastructure, Neuquén properties, RWA tokens and USDC dividends for qualified investors.',
  keywords: [
    'Argentina shale investment',
    'shale Argentina',
    'Vaca Muerta investment',
    'shale infrastructure',
    'RWA Argentina',
    'Neuquén real estate'
  ],
  sections: [
    {
      heading: 'Shale and infrastructure demand',
      paragraphs: [
        'Argentina shale investment in conventional and unconventional production drives offices, logistics, housing and services in Neuquén and the wider basin.',
        'Investors seeking sector exposure without operating wells can consider tokenized real estate with B2B leases tied to energy activity.'
      ]
    },
    {
      heading: 'Hard-currency income via RWA',
      paragraphs: [
        'RWA tokens on Sanova Global settle distributions per asset policy, with on-chain USDC and segregation by fiduciary compartment.',
        'The model combines Argentina shale investment (derived demand) with tokenization and KYC compliance for private placement.'
      ]
    },
    {
      heading: 'Access process',
      paragraphs: [
        'Platform registration, identity verification and review of asset documentation. Only investors meeting private placement criteria.',
        'Educational. Not investment advice or a public offering.'
      ]
    }
  ]
};

const inversionVacaMuertaEs: BlogArticle = {
  slug: 'inversion-vaca-muerta-rwa',
  publishedAt: '2026-06-12',
  title: 'Inversión en Vaca Muerta: RWA tokens e inmuebles tokenizados',
  description:
    'Guía sobre inversión en Vaca Muerta mediante activos reales tokenizados (RWA): inmuebles Neuquén, rentas USDC, tokenización y colocación privada con KYC.',
  keywords: [
    'vaca muerta inversión',
    'Vaca Muerta tokenización',
    'RWA tokens Argentina',
    'inmuebles Neuquén',
    'inversión shale Argentina',
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
    'Vaca Muerta tokenization',
    'RWA tokens Argentina',
    'Neuquén real estate',
    'Argentina shale investment',
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
  'vaca-muerta-tokenizacion': {
    es: vacaMuertaTokenizacionEs,
    en: vacaMuertaTokenizacionEn
  },
  'inmuebles-neuquen': {
    es: inmueblesNeuquenEs,
    en: inmueblesNeuquenEn
  },
  'rwa-argentina': {
    es: rwaArgentinaEs,
    en: rwaArgentinaEn
  },
  'inversion-shale-argentina': {
    es: inversionShaleEs,
    en: inversionShaleEn
  },
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
