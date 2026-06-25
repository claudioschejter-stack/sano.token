import type { Metadata } from 'next';
import { ContactPage } from '../../../components/landing/ContactPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import { messagesByLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/contacto');
  const contact = messagesByLocale[locale].contact;

  // fix: 2 per-page og:title and og:description
  // fix: 7 use title.absolute to prevent "| Sanova Global | Sanova Global" duplication
  const ogTitle = `${contact.title} | Sanova Global`;
  return {
    ...base,
    title: { absolute: ogTitle },
    description: contact.subtitle,
    openGraph: {
      ...base.openGraph,
      title: ogTitle,
      description: contact.subtitle
    },
    twitter: {
      ...base.twitter,
      title: ogTitle,
      description: contact.subtitle
    }
  };
}

export default function ContactoPage() {
  return <ContactPage />;
}
