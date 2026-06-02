import type { Metadata } from 'next';
import { LegalTerms } from '../../../components/landing/LegalTerms';
import { LEGAL_SITE_URL } from '../../../lib/legal/legalConfig';

export const metadata: Metadata = {
  title: 'Términos Legales | Sanova Global',
  description:
    'Términos Legales y Condiciones de Uso de Sanova Global SAS. Fideicomiso Sanova Global RWA, Compartimentos, colocación privada, whitelist, activos internacionales y bóvedas ERC-4626 (Base).',
  alternates: {
    canonical: `${LEGAL_SITE_URL}/terminos`
  }
};

export default function TerminosPage() {
  return <LegalTerms />;
}
