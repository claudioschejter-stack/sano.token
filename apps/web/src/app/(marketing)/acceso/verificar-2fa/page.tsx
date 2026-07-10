import type { Metadata } from 'next';
import { TOTPVerificationPage } from '../../../../components/auth/TOTPVerificationPage';
import { resolveServerLocale } from '../../../../i18n/detectLocaleServer';
import { messagesByLocale } from '../../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  return {
    title: messagesByLocale[locale].legalPagesMeta.totpVerifyTitle,
    robots: { index: false }
  };
}

export default function Verificar2FAPage() {
  return <TOTPVerificationPage />;
}
