import type { Metadata } from 'next';
import './globals.css';
import { PwaRegister } from '../components/PwaRegister';
import { WhatsAppFloat } from '../components/WhatsAppFloat';
import { AppProviders } from '../components/providers/AppProviders';
import { es } from '../i18n/locales/es';

export const metadata: Metadata = {
  title: es.meta.title,
  description: es.meta.description,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: es.meta.pwaTitle,
    statusBarStyle: 'default'
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#2563eb'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" dir="ltr" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <AppProviders>
          <PwaRegister />
          {children}
          <WhatsAppFloat />
        </AppProviders>
      </body>
    </html>
  );
}
