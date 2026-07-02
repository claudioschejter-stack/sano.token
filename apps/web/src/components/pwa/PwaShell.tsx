'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Building2,
  ScanLine,
  Settings,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { useEffect } from 'react';
import { ThemeToggleButton } from '../layout/ThemeToggleButton';
import { useTranslation } from '../../i18n/LocaleProvider';

type Props = {
  children: React.ReactNode;
};

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PwaShell({ children }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const t = useTranslation();
  const firstName = session?.user?.name?.split(' ')[0]?.toUpperCase() ?? 'INVERSOR';

  useEffect(() => {
    document.body.classList.add('mobile-portal-active');
    return () => document.body.classList.remove('mobile-portal-active');
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-40 bg-[#009EE3] px-4 pb-4 pt-safe-top shadow-sm">
        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
              {firstName.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-medium text-white/80">Sanova Capital</p>
              <p className="text-sm font-semibold text-white">Hola, {firstName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleButton variant="compact" />
            <Link
              href="/dashboard/settings/security"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
              aria-label={t.nav.settings}
            >
              <Settings size={20} />
            </Link>
          </div>
        </div>
      </header>

      <main className="mobile-portal-main min-h-0 flex-1 overflow-y-auto px-4 pb-[5.5rem] pt-4">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-white pb-safe">
        <div className="flex h-[4.5rem] items-center justify-around px-2">
          <Link
            href="/dashboard"
            className={`flex w-16 flex-col items-center justify-center gap-1 ${
              isActive(pathname, '/dashboard') ? 'text-[#009EE3]' : 'text-slate-400'
            }`}
          >
            <Building2 size={24} />
            <span className="text-[10px] font-medium">{t.nav.panel}</span>
          </Link>
          <Link
            href="/marketplace"
            className={`flex w-16 flex-col items-center justify-center gap-1 ${
              isActive(pathname, '/marketplace') ? 'text-[#009EE3]' : 'text-slate-400'
            }`}
          >
            <Wallet size={24} />
            <span className="text-[10px] font-medium">{t.nav.marketplace}</span>
          </Link>
          <div className="relative -top-5 flex w-16 flex-col items-center justify-center">
            <Link
              href="/marketplace/carrito"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[#009EE3] text-white shadow-lg shadow-[#009EE3]/30 ring-4 ring-white"
              aria-label="Pagar / QR"
            >
              <ScanLine size={28} />
            </Link>
          </div>
          <Link
            href="/dashboard/cash-flow"
            className={`flex w-16 flex-col items-center justify-center gap-1 ${
              isActive(pathname, '/dashboard/cash-flow') ? 'text-[#009EE3]' : 'text-slate-400'
            }`}
          >
            <TrendingUp size={24} />
            <span className="text-[10px] font-medium">{t.nav.cashFlow}</span>
          </Link>
          <Link
            href="/dashboard/settings/security"
            className={`flex w-16 flex-col items-center justify-center gap-1 ${
              isActive(pathname, '/dashboard/settings/security') ? 'text-[#009EE3]' : 'text-slate-400'
            }`}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
              {firstName.charAt(0)}
            </div>
            <span className="text-[10px] font-medium">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
