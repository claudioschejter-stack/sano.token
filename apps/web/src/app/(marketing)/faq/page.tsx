import type { Metadata } from 'next';
import { FaqPage } from '../../../components/landing/FaqPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';

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
  return {
    ...base,
    title: isEs
      ? 'Preguntas Frecuentes — Inversión RWA Tokenizada | Sanova Global'
      : 'FAQ — Tokenized RWA Investment Vaca Muerta | Sanova Global',
    description: isEs
      ? 'Respondemos todas las dudas sobre inversión en tokens RWA de Vaca Muerta: KYC, rendimientos en USDC, regulación argentina, riesgos, tokens ERC-4626 y mercado secundario.'
      : 'All your questions about tokenized RWA investment in Vaca Muerta: KYC process, USDC yields, Argentine regulation, ERC-4626 tokens, risks, and secondary market.'
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
