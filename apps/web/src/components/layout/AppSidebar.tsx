'use client';

import {
  ArrowLeftRight,
  Building2,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingBag,
  UserCheck,
  Users,
  UserCog,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { SystemRole } from '../../lib/auth/roles';

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type InvestorNavConfig = {
  href: string;
  icon: LucideIcon;
  labelKey: 'home' | 'dashboard' | 'marketplace' | 'secondaryMarket' | 'myAssets' | 'cashFlow';
  roles?: SystemRole[];
};

const adminNavItems = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'panel' as const },
  { href: '/dashboard/investors', icon: Users, labelKey: 'investors' as const },
  { href: '/dashboard/assets', icon: Building2, labelKey: 'assets' as const },
  { href: '/dashboard/treasury', icon: Wallet, labelKey: 'treasury' as const },
  { href: '/dashboard/team', icon: UserCog, labelKey: 'team' as const },
  { href: '/dashboard/settings', icon: Settings, labelKey: 'settings' as const }
];

type AdvisorNavConfig = {
  href: string;
  icon: LucideIcon;
  labelKey: 'panel' | 'clients' | 'marketplace' | 'secondaryMarket';
};

const advisorNavItems: AdvisorNavConfig[] = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'panel' },
  { href: '/dashboard/clients', icon: UserCheck, labelKey: 'clients' },
  { href: '/marketplace', icon: ShoppingBag, labelKey: 'marketplace' },
  { href: '/mercado-secundario', icon: ArrowLeftRight, labelKey: 'secondaryMarket' }
];

const investorNavItems: InvestorNavConfig[] = [
  { href: '/', icon: Home, labelKey: 'home' },
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
  { href: '/marketplace', icon: ShoppingBag, labelKey: 'marketplace' },
  { href: '/mercado-secundario', icon: ArrowLeftRight, labelKey: 'secondaryMarket' },
  {
    href: '/dashboard/portfolio',
    icon: Building2,
    labelKey: 'myAssets',
    roles: ['INVESTOR']
  },
  {
    href: '/dashboard/cash-flow',
    icon: Wallet,
    labelKey: 'cashFlow',
    roles: ['INVESTOR', 'TREASURY']
  }
];

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslation();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const roleLabels = t.access.roles as Record<SystemRole, string>;
  const isAdmin = role === 'ADMIN';
  const isAdvisorStaff = role === 'ADVISOR' || role === 'ADVISOR_MANAGER';

  const visibleInvestorItems = investorNavItems.filter((item) => {
    if (!item.roles || !role) {
      return true;
    }

    return item.roles.includes(role);
  });

  async function handleSignOut() {
    window.localStorage.removeItem('sanova.jwt');
    await signOut({ callbackUrl: '/acceso' });
  }

  function renderNavItem(item: NavItem) {
    const isActive =
      item.href === '/'
        ? pathname === '/'
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;

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
        <span>{item.label}</span>
      </Link>
    );
  }

  const adminItems: NavItem[] = adminNavItems.map((item) => ({
    href: item.href,
    icon: item.icon,
    label: t.adminNav[item.labelKey]
  }));

  const investorItems: NavItem[] = visibleInvestorItems.map((item) => ({
    href: item.href,
    icon: item.icon,
    label: t.nav[item.labelKey]
  }));

  const advisorItems: NavItem[] = advisorNavItems.map((item) => ({
    href: item.href,
    icon: item.icon,
    label:
      item.labelKey === 'clients'
        ? t.advisorPortal.navClients
        : item.labelKey === 'marketplace'
          ? t.nav.marketplace
          : item.labelKey === 'secondaryMarket'
            ? t.nav.secondaryMarket
            : t.adminNav.panel
  }));

  return (
    <aside className="flex w-64 flex-col border-r border-terminal-border bg-terminal-card text-terminal-text">
      <div className="border-b border-terminal-border p-6">
        <Link href="/" className="block transition-opacity hover:opacity-90">
          <h2 className="text-2xl font-bold tracking-tight">Sanova Global</h2>
          <p className="mt-1 text-sm text-terminal-muted">
            {isAdmin
              ? t.adminDashboard.sidebarSubtitle
              : isAdvisorStaff
                ? t.advisorPortal.clientsTitle
                : t.brand.portalSubtitle}
          </p>
          {role ? (
            <p className="mt-2 inline-flex rounded-full border border-terminal-primary/30 bg-terminal-bg px-2.5 py-0.5 text-xs font-medium text-terminal-primary">
              {roleLabels[role]}
            </p>
          ) : null}
        </Link>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        {(isAdmin ? adminItems : isAdvisorStaff ? advisorItems : investorItems).map(renderNavItem)}

        {isAdmin ? (
          <>
            <Link
              href="/marketplace"
              className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-terminal-muted transition-colors hover:bg-terminal-bg hover:text-terminal-text"
            >
              <ShoppingBag size={20} />
              <span>{t.adminNav.viewMarketplace}</span>
            </Link>
            <Link
              href="/mercado-secundario"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-terminal-muted transition-colors hover:bg-terminal-bg hover:text-terminal-text"
            >
              <ArrowLeftRight size={20} />
              <span>{t.nav.secondaryMarket}</span>
            </Link>
          </>
        ) : null}
      </nav>

      <div className="border-t border-terminal-border p-4">
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
