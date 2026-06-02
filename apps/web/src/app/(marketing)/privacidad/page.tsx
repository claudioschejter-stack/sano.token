import type { Metadata } from 'next';
import { PrivacyPolicyPage } from '../../../components/landing/PrivacyPolicyPage';
import { LEGAL_SITE_URL } from '../../../lib/legal/legalConfig';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Sanova Global',
  description:
    'Política de Privacidad de Sanova Global SAS. Fideicomiso Sanova Global RWA, Compartimentos, KYC/AML, Ley 25.326 y tratamiento de datos Web3.',
  alternates: {
    canonical: `${LEGAL_SITE_URL}/privacidad`
  }
};

export default function PrivacidadPage() {
  return <PrivacyPolicyPage />;
}
