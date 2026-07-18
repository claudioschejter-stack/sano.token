'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Bell,
  Building2,
  Landmark,
  Search,
  ShoppingCart,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { useProfilePhoto } from '../../hooks/useProfilePhoto';
import { useNotifications } from '../../hooks/useNotifications';
import { useAccountStatus } from '../../hooks/useAccountStatus';
import { MP_ACCENT, MP_ACCENT_SOFT } from '../../lib/pwa/mpTheme';
import { getWhatsAppPhone, getWhatsAppUrl } from '../../config/site';
import { WhatsAppIcon } from '../WhatsAppFloat';
import { BrowserFullscreenBanner } from './BrowserFullscreenBanner';
import { PwaSectionTabs } from './PwaSectionTabs';

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
  const { profile } = useAccountStatus();
  const firstName =
    profile?.fullName?.split(' ')[0]?.toUpperCase() ??
    session?.user?.name?.split(' ')[0]?.toUpperCase() ??
    'INVERSOR';
  const photoUrl = useProfilePhoto();
  const { unreadCount } = useNotifications();
  const [whatsappPhone, setWhatsappPhone] = useState(() => getWhatsAppPhone());

  useEffect(() => {
    document.body.classList.add('mobile-portal-active');
    return () => document.body.classList.remove('mobile-portal-active');
  }, []);

  useEffect(() => {
    void fetch('/api/site-config')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { whatsappPhone?: string } | null) => {
        if (data?.whatsappPhone) {
          setWhatsappPhone(data.whatsappPhone.replace(/\D/g, ''));
        }
      })
      .catch(() => undefined);
  }, []);

  const whatsappHref = getWhatsAppUrl(t.common.whatsappMessage, whatsappPhone);

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-40 bg-[#009EE3] pt-safe-top shadow-sm">
        <BrowserFullscreenBanner />
        <div className="flex items-center justify-between px-4 pb-4 pt-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/20 text-sm font-bold text-white">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                firstName.charAt(0)
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-white/80">Sanova Capital</p>
              <p className="text-sm font-semibold text-white">
                {t.pwaHome.greeting.replace('{name}', firstName)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/marketplace"
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
              aria-label={t.pwaHome.searchAria}
            >
              <Search size={18} />
            </Link>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white"
                aria-label={t.pwaHome.whatsappAria}
                title={t.pwaHome.whatsappAria}
              >
                <WhatsAppIcon size={18} />
              </a>
            ) : null}
            <Link
              href="/dashboard/portfolio?tab=wallet"
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
              aria-label={t.pwaHome.walletAria}
            >
              <Wallet size={18} />
            </Link>
            <Link
              href="/dashboard/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: MP_ACCENT_SOFT, color: MP_ACCENT }}
              aria-label={t.pwaHome.notificationsAria}
            >
              <Bell size={18} />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </header>

      <PwaSectionTabs />

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
            href="/dashboard/inversiones"
            className={`flex w-16 flex-col items-center justify-center gap-1 ${
              isActive(pathname, '/dashboard/inversiones') ? 'text-[#009EE3]' : 'text-slate-400'
            }`}
          >
            <Landmark size={24} />
            <span className="text-[10px] font-medium">{t.nav.investments}</span>
          </Link>
          <div className="relative flex w-16 flex-col items-center justify-center">
            <Link
              href="/marketplace/carrito"
              className={`relative -top-5 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-white ${
                isActive(pathname, '/marketplace/carrito')
                  ? 'bg-[#0077b3] shadow-[#0077b3]/40'
                  : 'bg-[#009EE3] shadow-[#009EE3]/30'
              }`}
              aria-label={t.pwaHome.cartFabAria}
            >
              <ShoppingCart size={26} />
            </Link>
            <span
              className={`-mt-3 text-[10px] font-medium ${
                isActive(pathname, '/marketplace/carrito') ? 'text-[#009EE3]' : 'text-slate-400'
              }`}
            >
              {t.pwaHome.cartNavLabel}
            </span>
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
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xs font-bold text-slate-600">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                firstName.charAt(0)
              )}
            </div>
            <span className="text-[10px] font-medium">{t.pwaHome.profileNavLabel}</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
