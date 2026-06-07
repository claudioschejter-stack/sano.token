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
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  },
  appleWebApp: {
    capable: true,
    title: es.meta.pwaTitle,
    statusBarStyle: 'default'
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
  themeColor: '#2563eb'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" dir="ltr" suppressHydrationWarning>
      <body className="min-h-dvh antialiased touch-manipulation">
        <AppProviders>
          <PwaRegister />
          {children}
          <WhatsAppFloat />
        </AppProviders>
      </body>
    </html>
  );
}
