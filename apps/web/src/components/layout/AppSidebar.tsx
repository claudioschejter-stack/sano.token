'use client';

import { Building, Home, LayoutDashboard, LogOut, ShoppingBag, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTranslation } from '../../i18n/LocaleProvider';
import { LocaleSwitcher } from '../marketplace/LocaleSwitcher';
import type { SystemRole } from '../../lib/auth/roles';
import { isStaffRole } from '../../lib/auth/roles';

const navItems = [
  { href: '/', icon: Home, labelKey: 'home' as const, roles: null },
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' as const, roles: null },
  { href: '/marketplace', icon: ShoppingBag, labelKey: 'marketplace' as const, roles: null },
  {
    href: '/dashboard/portfolio',
    icon: Building,
    labelKey: 'myAssets' as const,
    roles: ['INVESTOR', 'ADVISOR', 'ADVISOR_MANAGER', 'ADMIN'] as SystemRole[]
  },
  {
    href: '/dashboard/cash-flow',
    icon: Wallet,
    labelKey: 'cashFlow' as const,
    roles: ['INVESTOR', 'ADMIN', 'TREASURY'] as SystemRole[]
  }
];

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslation();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const roleLabels = t.access.roles as Record<SystemRole, string>;

  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles || !role) {
      return true;
    }

    return item.roles.includes(role);
  });

  async function handleSignOut() {
    window.localStorage.removeItem('sanova.jwt');
    await signOut({ callbackUrl: '/acceso' });
  }

  return (
    <aside className="flex w-64 flex-col border-r border-terminal-border bg-terminal-card text-terminal-text">
      <div className="border-b border-terminal-border p-6">
        <Link href="/" className="block transition-opacity hover:opacity-90">
          <h2 className="text-2xl font-bold tracking-tight">Sanova Global</h2>
          <p className="mt-1 text-sm text-terminal-muted">{t.brand.portalSubtitle}</p>
          {role ? (
            <p className="mt-2 inline-flex rounded-full border border-terminal-primary/30 bg-terminal-bg px-2.5 py-0.5 text-xs font-medium text-terminal-primary">
              {roleLabels[role]}
            </p>
          ) : null}
        </Link>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        {visibleNavItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const label = t.nav[item.labelKey];

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                isActive
                  ? 'border border-terminal-primary/40 bg-terminal-bg text-terminal-primary'
                  : 'text-terminal-muted hover:bg-terminal-bg hover:text-terminal-text'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}

        {role && isStaffRole(role) ? (
          <p className="px-3 pt-4 text-xs text-terminal-muted">{t.access.staffPanelHint}</p>
        ) : null}
      </nav>

      <div className="space-y-4 border-t border-terminal-border p-4">
        <LocaleSwitcher />
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2 text-terminal-muted transition-colors hover:text-terminal-text"
        >
          <LogOut size={20} />
          <span>{t.nav.signOut}</span>
        </button>
      </div>
    </aside>
  );
}
