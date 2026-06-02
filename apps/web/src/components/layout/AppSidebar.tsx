'use client';

import {
  ArrowLeftRight,
  Building2,
  CircleDollarSign,
  Home,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShoppingBag,
  UserCheck,
  Users,
  UserCog,
  Wallet,
  X
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '../../i18n/LocaleProvider';
import type { SystemRole } from '../../lib/auth/roles';
import { SidebarUserStatus } from './SidebarUserStatus';

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type InvestorNavConfig = {
  href: string;
  icon: LucideIcon;
  labelKey: 'home' | 'panel' | 'marketplace' | 'secondaryMarket' | 'myAssets' | 'myWallet' | 'cashFlow';
  roles?: SystemRole[];
};

const adminNavItems = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'panel' as const },
  { href: '/dashboard/investors', icon: Users, labelKey: 'investors' as const },
  { href: '/dashboard/assets', icon: Building2, labelKey: 'assets' as const },
  { href: '/dashboard/loans', icon: Landmark, labelKey: 'loans' as const },
  { href: '/dashboard/treasury', icon: Wallet, labelKey: 'treasury' as const },
  { href: '/dashboard/commissions', icon: CircleDollarSign, labelKey: 'commissions' as const },
  { href: '/dashboard/team', icon: UserCog, labelKey: 'team' as const },
  { href: '/dashboard/settings', icon: Settings, labelKey: 'settings' as const }
];

type AdvisorNavConfig = {
  href: string;
  icon: LucideIcon;
  labelKey: 'panel' | 'clients' | 'marketplace' | 'secondaryMarket' | 'myWallet';
};

const advisorNavItems: AdvisorNavConfig[] = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'panel' },
  { href: '/dashboard/clients', icon: UserCheck, labelKey: 'clients' },
  { href: '/dashboard/wallet', icon: CircleDollarSign, labelKey: 'myWallet' },
  { href: '/marketplace', icon: ShoppingBag, labelKey: 'marketplace' },
  { href: '/mercado-secundario', icon: ArrowLeftRight, labelKey: 'secondaryMarket' }
];

const investorNavItems: InvestorNavConfig[] = [
  { href: '/', icon: Home, labelKey: 'home' },
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'panel' },
  { href: '/dashboard/wallet', icon: CircleDollarSign, labelKey: 'myWallet' },
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

type SidebarContentProps = {
  panelItem: NavItem | undefined;
  secondaryNavItems: NavItem[];
  isAdmin: boolean;
  isAdvisorStaff: boolean;
  onNavigate?: () => void;
  renderNavItem: (item: NavItem, onNavigate?: () => void) => ReactNode;
};

function SidebarContent({
  panelItem,
  secondaryNavItems,
  isAdmin,
  isAdvisorStaff,
  onNavigate,
  renderNavItem
}: SidebarContentProps) {
  const t = useTranslation();

  return (
    <>
      <div className="border-b border-terminal-border p-6">
        <Link href="/" className="block transition-opacity hover:opacity-90" onClick={onNavigate}>
          <h2 className="text-2xl font-bold tracking-tight">Sanova Global</h2>
          <p className="mt-1 text-sm text-terminal-muted">
            {isAdmin
              ? t.adminDashboard.sidebarSubtitle
              : isAdvisorStaff
                ? t.advisorPortal.clientsTitle
                : t.brand.portalSubtitle}
          </p>
        </Link>
      </div>

      <div className="px-4 pt-4">
        <SidebarUserStatus />
        {panelItem ? renderNavItem(panelItem, onNavigate) : null}
      </div>

      <div className="mx-4 border-t border-terminal-border" />

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {secondaryNavItems.map((item) => renderNavItem(item, onNavigate))}

        {isAdmin ? (
          <>
            <Link
              href="/dashboard/wallet"
              onClick={onNavigate}
              className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-terminal-muted transition-colors hover:bg-terminal-bg hover:text-terminal-text"
            >
              <CircleDollarSign size={20} />
              <span>{t.nav.myWallet}</span>
            </Link>
            <Link
              href="/marketplace"
              onClick={onNavigate}
              className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-terminal-muted transition-colors hover:bg-terminal-bg hover:text-terminal-text"
            >
              <ShoppingBag size={20} />
              <span>{t.adminNav.viewMarketplace}</span>
            </Link>
            <Link
              href="/mercado-secundario"
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-terminal-muted transition-colors hover:bg-terminal-bg hover:text-terminal-text"
            >
              <ArrowLeftRight size={20} />
              <span>{t.nav.secondaryMarket}</span>
            </Link>
          </>
        ) : null}
      </nav>
    </>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslation();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = session?.user?.role;
  const isAdmin = role === 'ADMIN';
  const isAdvisorStaff = role === 'ADVISOR' || role === 'ADVISOR_MANAGER';

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

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

  function renderNavItem(item: NavItem, onNavigate?: () => void) {
    const isActive =
      item.href === '/'
        ? pathname === '/'
        : pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
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
    label:
      item.labelKey === 'panel'
        ? t.adminNav.panel
        : t.nav[item.labelKey as Exclude<InvestorNavConfig['labelKey'], 'panel'>]
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
            : item.labelKey === 'myWallet'
              ? t.nav.myWallet
              : t.adminNav.panel
  }));

  const primaryNavItems = isAdmin ? adminItems : isAdvisorStaff ? advisorItems : investorItems;
  const panelItem = primaryNavItems.find((item) => item.href === '/dashboard');
  const secondaryNavItems = primaryNavItems.filter((item) => item.href !== '/dashboard');
  const closeMobile = () => setMobileOpen(false);

  const signOutButton = (
    <button
      type="button"
      onClick={handleSignOut}
      className="flex w-full items-center gap-3 px-3 py-2 text-terminal-muted transition-colors hover:text-terminal-text"
    >
      <LogOut size={20} />
      <span>{t.nav.signOut}</span>
    </button>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-terminal-border bg-terminal-card px-4 md:hidden">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Sanova Global
        </Link>
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setMobileOpen((open) => !open)}
          className="rounded-lg border border-terminal-border p-2 text-terminal-text"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={`fixed inset-x-auto bottom-0 left-0 top-14 z-50 flex w-72 max-w-[85vw] flex-col border-r border-terminal-border bg-terminal-card text-terminal-text transition-transform duration-200 md:static md:inset-auto md:top-auto md:z-auto md:h-full md:w-64 md:max-w-none md:shrink-0 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <SidebarContent
          panelItem={panelItem}
          secondaryNavItems={secondaryNavItems}
          isAdmin={isAdmin}
          isAdvisorStaff={isAdvisorStaff}
          onNavigate={closeMobile}
          renderNavItem={renderNavItem}
        />
        <div className="mt-auto shrink-0 space-y-3 border-t border-terminal-border p-4">
          <div className="flex flex-wrap gap-3 text-xs text-terminal-muted">
            <Link href="/terminos" className="hover:text-terminal-text">
              {t.legal.portalFooterTerms}
            </Link>
            <Link href="/privacidad" className="hover:text-terminal-text">
              {t.legal.portalFooterPrivacy}
            </Link>
          </div>
          {signOutButton}
        </div>
      </aside>
    </>
  );
}
