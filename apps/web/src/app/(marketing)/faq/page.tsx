import type { Metadata } from 'next';
import { FaqPage } from '../../../components/landing/FaqPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import { withLocalePrefix } from '../../../lib/i18n/localeRouting';
import { getSiteUrl } from '../../../lib/seo/siteUrl';

const FAQ_SCHEMA_ITEMS = [
  {
    question: '¿Qué es un token RWA?',
    answer:
      'Un token RWA (Real World Asset) es una representación digital de un activo real en una blockchain. En Sanova Global, los tokens representan cuotapartes del Fideicomiso Sanova Global RWA, con subyacente en proyectos de Vaca Muerta.'
  },
  {
    question: '¿Cómo funciona la tokenización en Sanova?',
    answer:
      'Sanova emite tokens ERC-4626 sobre la red Base. Cada token representa una participación proporcional en el patrimonio del fideicomiso. Los inversores reciben rendimientos en USDC en su wallet.'
  },
  {
    question: '¿Es legal invertir en Sanova desde Argentina?',
    answer:
      'Sí. Sanova Global SAS opera bajo la Ley 24.441. Es una colocación privada de cuotapartes fiduciarias; no constituye oferta pública de valores negociables.'
  },
  {
    question: '¿Puedo invertir desde el exterior?',
    answer:
      'Sí. Aceptamos inversores de más de 15 países. El proceso de KYC es 100% digital y los rendimientos se distribuyen en USDC a tu wallet Privy.'
  },
  {
    question: '¿Cuáles son los riesgos de invertir en tokens RWA?',
    answer:
      'Existen riesgos de volatilidad del precio del petróleo/gas, riesgo regulatorio, riesgo operacional del fideicomiso y riesgo de liquidez. Consulte los Términos Legales antes de invertir.'
  },
  {
    question: '¿Cómo recibo los rendimientos?',
    answer:
      'Los rendimientos se distribuyen en USDC sobre la red Base directamente a tu wallet Privy. Podés retirarlos a cualquier wallet externa en cualquier momento.'
  },
  {
    question: '¿Cuál es el monto mínimo de inversión?',
    answer:
      'El monto mínimo varía según el compartimento. Consultá el marketplace para ver las condiciones vigentes de cada proyecto.'
  }
];

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/faq');
  const isEs = locale === 'es';

  // fix: 2 per-page og:title and og:description
  // fix: 7 use title.absolute to prevent template appending a second "| Sanova Global"
  // fix: 8 per-page meta keywords
  const ogTitle = isEs
    ? 'Preguntas Frecuentes | Sanova Global'
    : 'FAQ | Sanova Global';
  const ogDescription = isEs
    ? 'Respondemos las dudas más frecuentes sobre RWA, tokens ERC-4626, Vaca Muerta, KYC y rendimientos en USDC.'
    : 'Answers to the most common questions about RWA, ERC-4626 tokens, Vaca Muerta, KYC, and USDC yields.';

  return {
    ...base,
    title: { absolute: ogTitle },
    description: ogDescription,
    keywords: isEs
      ? ['FAQ RWA Argentina', 'preguntas tokens Vaca Muerta', 'cómo invertir USDC Argentina', 'KYC tokenización', 'rendimientos on-chain']
      : ['FAQ RWA Argentina', 'Vaca Muerta token questions', 'how to invest USDC Argentina', 'KYC tokenization', 'on-chain yields'],
    openGraph: {
      ...base.openGraph,
      title: ogTitle,
      description: ogDescription,
      url: `${getSiteUrl()}${withLocalePrefix(locale, '/faq')}`
    },
    twitter: {
      ...base.twitter,
      title: ogTitle,
      description: ogDescription
    }
  };
}

function FaqJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_SCHEMA_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer }
    }))
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function FaqPageRoute() {
  return (
    <>
      <FaqJsonLd />
      <FaqPage />
    </>
  );
}
