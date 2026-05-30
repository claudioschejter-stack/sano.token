import type { Metadata } from 'next';
import { PrivacyPolicyPage } from '../../../components/landing/PrivacyPolicyPage';
import { LEGAL_SITE_URL } from '../../../lib/legal/legalConfig';

export const metadata: Metadata = {
  title: 'Política de Privacidad | Sanova Global',
  description:
    'Política de Privacidad y Protección de Datos de Sanova Global SAS. Tratamiento de datos conforme a la Ley 25.326 (Argentina) y normativas AML/CFT.',
  alternates: {
    canonical: `${LEGAL_SITE_URL}/privacidad`
  }
};

export default function PrivacidadPage() {
  return <PrivacyPolicyPage />;
}
