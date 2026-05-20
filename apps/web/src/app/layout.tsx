import type { Metadata } from 'next';
import './globals.css';
import { PwaRegister } from '../components/PwaRegister';
import { AppProviders } from '../components/providers/AppProviders';
import { AppSidebar } from '../components/layout/AppSidebar';

export const metadata: Metadata = {
  title: 'Sanova Global — Portal RWA',
  description: 'Marketplace de activos reales tokenizados',
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
      <body className="min-h-screen bg-terminal-bg antialiased">
        <AppProviders>
          <PwaRegister />
          <div className="flex h-screen bg-terminal-bg">
            <AppSidebar />
            <main className="flex-1 overflow-y-auto bg-terminal-bg p-8 text-terminal-text">{children}</main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
