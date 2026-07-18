import type { Metadata } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { SiteAnalytics } from '../components/analytics/SiteAnalytics';
import { PwaRegister } from '../components/PwaRegister';
import { WhatsAppFloat } from '../components/WhatsAppFloat';
import { AppProviders } from '../components/providers/AppProviders';
import { SiteJsonLd } from '../components/seo/SiteJsonLd';
import { resolveServerLocale } from '../i18n/detectLocaleServer';
import { buildSiteMetadata, htmlDirForLocale, htmlLangForLocale } from '../lib/seo/buildMetadata';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveServerLocale();
  return buildSiteMetadata(locale);
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#1278BE'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await resolveServerLocale();
  return (
    <html
      lang={htmlLangForLocale(locale)}
      dir={htmlDirForLocale(locale)}
      className="dark"
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sanova" />
        <SiteJsonLd locale={locale} />
      </head>
      <body className="min-h-dvh antialiased touch-manipulation">
        <SiteAnalytics />
        <SpeedInsights />
        <AppProviders>
          <PwaRegister />
          {children}
          <WhatsAppFloat />
        </AppProviders>
      </body>
    </html>
  );
}
