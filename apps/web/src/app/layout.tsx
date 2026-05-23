import type { Metadata } from 'next';
import './globals.css';
import { PwaRegister } from '../components/PwaRegister';
import { WhatsAppFloat } from '../components/WhatsAppFloat';
import { AppProviders } from '../components/providers/AppProviders';

export const metadata: Metadata = {
  title: 'Sanova Global — Real Estate Tokenizado',
  description: 'Invertí en activos reales tokenizados con rentas on-chain y cumplimiento KYC.',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    title: 'Sanova RWA',
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
