'use client';

import { Building, Home, LayoutDashboard, LogOut, ShoppingBag, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '../../i18n/LocaleProvider';
import { LocaleSwitcher } from '../marketplace/LocaleSwitcher';

const navItems = [
  { href: '/', icon: Home, labelKey: 'home' as const },
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' as const },
  { href: '/marketplace', icon: ShoppingBag, labelKey: 'marketplace' as const },
  { href: '/dashboard/portfolio', icon: Building, labelKey: 'myAssets' as const },
  { href: '/dashboard/cash-flow', icon: Wallet, labelKey: 'cashFlow' as const }
];

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslation();

  return (
    <aside className="flex w-64 flex-col border-r border-terminal-border bg-terminal-card text-terminal-text">
      <div className="border-b border-terminal-border p-6">
        <h2 className="text-2xl font-bold tracking-tight">Sanova Global</h2>
        <p className="mt-1 text-sm text-terminal-muted">{t.brand.portalSubtitle}</p>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        {navItems.map((item) => {
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
      </nav>

      <div className="space-y-4 border-t border-terminal-border p-4">
        <LocaleSwitcher />
        <button
          type="button"
          className="flex w-full items-center gap-3 px-3 py-2 text-terminal-muted transition-colors hover:text-terminal-text"
        >
          <LogOut size={20} />
          <span>{t.nav.signOut}</span>
        </button>
      </div>
    </aside>
  );
}
