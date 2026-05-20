import type { Metadata } from 'next';
import './globals.css';
import { PwaRegister } from '../components/PwaRegister';
import { WhatsAppFloat } from '../components/WhatsAppFloat';
import { AppProviders } from '../components/providers/AppProviders';

export const metadata: Metadata = {
  title: 'Sanova Global — Real Estate Tokenizado',
  description: 'Invertí en activos reales tokenizados con rentas on-chain y cumplimiento KYC.',
  manifest: '/manifest.json',
  themeColor: '#3B82F6',
  appleWebApp: {
    capable: true,
    title: 'Sanova RWA',
    statusBarStyle: 'black-translucent'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
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
