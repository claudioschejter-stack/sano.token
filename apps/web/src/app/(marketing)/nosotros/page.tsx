import type { Metadata } from 'next';
import { NosotrosPage } from '../../../components/landing/NosotrosPage';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';
import { messagesByLocale } from '../../../i18n';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/nosotros');
  const aboutLabel = messagesByLocale[locale].landing.footer.about;
  const title = `${aboutLabel} | Sanova Global`;
  const description = messagesByLocale[locale].meta.description;
  return {
    ...base,
    title: { absolute: title },
    description,
    openGraph: {
      ...base.openGraph,
      title,
      description
    }
  };
}

export default function NosotrosPageRoute() {
  return <NosotrosPage />;
}
