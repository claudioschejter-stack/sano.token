import type { Metadata } from 'next';
import { OnboardingStatusProvider } from '../../../components/providers/OnboardingStatusProvider';
import { resolveServerLocale } from '../../../i18n/detectLocaleServer';
import { buildSiteMetadata } from '../../../lib/seo/buildMetadata';

/**
 * Auth surfaces must never inherit the homepage canonical from root layout.
 * Self-canonical + noindex aligns with robots.txt Disallow: /acceso and stops
 * GSC "Alternative page with proper canonical tag" on /xx/acceso*.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  const base = buildSiteMetadata(locale, '/acceso');
  return {
    ...base,
    title: 'Acceso',
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false }
    },
    // No hreflang cluster for noindex auth pages — only a self-canonical.
    alternates: {
      canonical: base.alternates?.canonical
    }
  };
}

export default function AccesoLayout({ children }: { children: React.ReactNode }) {
  return <OnboardingStatusProvider>{children}</OnboardingStatusProvider>;
}
