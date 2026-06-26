import type { Metadata } from 'next';
import { TOTPVerificationPage } from '../../../../components/auth/TOTPVerificationPage';

export const metadata: Metadata = {
  title: 'Verificación de seguridad — Sanova Capital',
  robots: { index: false }
};

export default function Verificar2FAPage() {
  return <TOTPVerificationPage />;
}
