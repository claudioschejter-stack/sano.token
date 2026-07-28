import type { Metadata } from 'next';
import { LegalTerms } from '../../../components/landing/LegalTerms';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import { messagesByLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/terminos');
  const m = messagesByLocale[locale].legalPagesMeta;
  return {
    ...base,
    title: { absolute: m.termsTitle },
    description: m.termsDescription
  };
}

export default function TerminosPage() {
  return <LegalTerms />;
}
