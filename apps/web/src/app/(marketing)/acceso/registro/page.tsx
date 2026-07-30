import type { Metadata } from 'next';
import { RegisterPage } from '../../../../components/landing/RegisterPage';
import { resolveServerLocale } from '../../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../../lib/seo/buildMetadata';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/acceso/registro');
  return {
    ...base,
    title: 'Registro',
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false }
    },
    alternates: {
      canonical: base.alternates?.canonical
    }
  };
}

export default function AccesoRegistroPage() {
  return <RegisterPage />;
}
