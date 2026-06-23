import type { Metadata } from 'next';
import { ContactPage } from '../../../components/landing/ContactPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import { messagesByLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/contacto');
  const contact = messagesByLocale[locale].contact;
  return {
    ...base,
    title: contact.title,
    description: contact.subtitle
  };
}

export default function ContactoPage() {
  return <ContactPage />;
}
