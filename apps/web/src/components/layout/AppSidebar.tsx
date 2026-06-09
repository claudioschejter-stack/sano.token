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
import { MarketplaceCartButton } from '../marketplace/MarketplaceCartButton';
import { PortalBrandFrames, PortalBrandFramesMobileHeader } from './PortalBrandFrames';

type NavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type InvestorNavConfig = {
  href: string;
  icon: LucideIcon;
  labelKey:
    | 'home'
    | 'panel'
    | 'marketplace'
    | 'secondaryMarket'
    | 'myAssets'
    | 'myWallet'
    | 'cashFlow';
  roles?: SystemRole[];
};

const adminNavItems = [
  { href: '/', icon: Home, labelKey: 'home' as const },
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
  labelKey: 'home' | 'panel' | 'clients' | 'marketplace' | 'secondaryMarket' | 'myWallet';
};

const advisorNavItems: AdvisorNavConfig[] = [
  { href: '/', icon: Home, labelKey: 'home' },
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'panel' },
  { href: '/dashboard/clients', icon: UserCheck, labelKey: 'clients' },
  { href: '/dashboard/wallet', icon: CircleDollarSign, labelKey: 'myWallet' },
  { href: '/marketplace', icon: ShoppingBag, labelKey: 'marketplace' },
  { href: '/mercado-secundario', icon: ArrowLeftRight, labelKey: 'secondaryMarket' }
];

const investorNavItems: InvestorNavConfig[] = [
  { href: '/', icon: Home, labelKey: 'home' },
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'panel' },
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
  topNavItem: NavItem | undefined;
  secondaryNavItems: NavItem[];
  isAdmin: boolean;
  isAdvisorStaff: boolean;
  onNavigate?: () => void;
  renderNavItem: (item: NavItem, onNavigate?: () => void) => ReactNode;
};

function SidebarContent({
  topNavItem,
  secondaryNavItems,
  isAdmin,
  isAdvisorStaff,
  onNavigate,
  renderNavItem
}: SidebarContentProps) {
  const t = useTranslation();

  const portalSubtitle = isAdmin
    ? t.adminDashboard.sidebarSubtitle
    : isAdvisorStaff
      ? t.advisorPortal.clientsTitle
      : t.brand.portalSubtitle;

  return (
    <>
      <div className="border-b border-terminal-border bg-terminal-card p-3">
        <PortalBrandFrames portalSubtitle={portalSubtitle} onNavigate={onNavigate} />
      </div>

      <div className="px-4 pt-4">
        <SidebarUserStatus />
        <div className="mt-3">
          <MarketplaceCartButton className="w-full justify-center" />
        </div>
        {topNavItem ? renderNavItem(topNavItem, onNavigate) : null}
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
    label: item.labelKey === 'home' ? t.nav.home : t.adminNav[item.labelKey]
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
      item.labelKey === 'home'
        ? t.nav.home
        : item.labelKey === 'clients'
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
  const homeItem = primaryNavItems.find((item) => item.href === '/');
  const panelItem = primaryNavItems.find((item) => item.href === '/dashboard');
  const topNavItem = homeItem ?? panelItem;
  const secondaryNavItems = [
    ...(homeItem && panelItem ? [panelItem] : []),
    ...primaryNavItems.filter((item) => item.href !== '/' && item.href !== '/dashboard')
  ];
  const closeMobile = () => setMobileOpen(false);

  const portalSubtitle = isAdmin
    ? t.adminDashboard.sidebarSubtitle
    : isAdvisorStaff
      ? t.advisorPortal.clientsTitle
      : t.brand.portalSubtitle;

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
      <header className="safe-top fixed inset-x-0 top-0 z-40 flex h-14 min-h-14 items-center justify-between gap-2 border-b border-terminal-border bg-terminal-card px-3 md:hidden">
        <PortalBrandFramesMobileHeader portalSubtitle={portalSubtitle} />
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? t.landing.nav.closeMenu : t.landing.nav.openMenu}
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-terminal-border text-terminal-text"
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
          topNavItem={topNavItem}
          secondaryNavItems={secondaryNavItems}
          isAdmin={isAdmin}
          isAdvisorStaff={isAdvisorStaff}
          onNavigate={closeMobile}
          renderNavItem={renderNavItem}
        />
        <div className="mt-auto shrink-0 border-t border-terminal-border p-4">
          {signOutButton}
        </div>
      </aside>
    </>
  );
}
