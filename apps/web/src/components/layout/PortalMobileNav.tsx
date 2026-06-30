'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import {
  getPortalMobileNavItems,
  isPortalMobileNavActive
} from '../../lib/mobile/portalMobileNav';

export function PortalMobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const t = useTranslation();
  const role = session?.user?.role;
  const items = getPortalMobileNavItems(role);

  if (!items.length) {
    return null;
  }

  return (
    <nav
      className="portal-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-terminal-border bg-terminal-card/95 backdrop-blur-md md:hidden"
      aria-label={t.mobile.bottomNavAria}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-safe pt-1">
        {items.map((item) => {
          const active = isPortalMobileNavActive(pathname, item);
          const Icon = item.icon;
          const label =
            item.labelKey === 'panel'
              ? t.nav.panel
              : item.labelKey === 'clients'
                ? t.advisorPortal.navClients
                : t.nav[item.labelKey];

          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium leading-tight transition-colors ${
                  active
                    ? 'text-terminal-primary'
                    : 'text-terminal-muted hover:text-terminal-text'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 2} aria-hidden />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
