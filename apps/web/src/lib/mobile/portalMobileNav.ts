import type { LucideIcon } from 'lucide-react';
import { Building2, LayoutDashboard, Landmark, ShoppingBag, UserCheck, Wallet } from 'lucide-react';
import type { SystemRole } from '../auth/roles';

export type PortalMobileNavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: 'panel' | 'marketplace' | 'investments' | 'myAssets' | 'cashFlow' | 'clients' | 'myWallet';
  matchPrefixes?: string[];
};

const investorItems: PortalMobileNavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'panel' },
  {
    href: '/dashboard/inversiones',
    icon: Landmark,
    labelKey: 'investments',
    matchPrefixes: ['/dashboard/inversiones']
  },
  {
    href: '/dashboard/portfolio',
    icon: Building2,
    labelKey: 'myAssets',
    matchPrefixes: ['/dashboard/portfolio']
  },
  {
    href: '/dashboard/cash-flow',
    icon: Wallet,
    labelKey: 'cashFlow',
    matchPrefixes: ['/dashboard/cash-flow']
  }
];

const advisorItems: PortalMobileNavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, labelKey: 'panel' },
  { href: '/dashboard/clients', icon: UserCheck, labelKey: 'clients' },
  {
    href: '/dashboard/portfolio',
    icon: Building2,
    labelKey: 'myAssets',
    matchPrefixes: ['/dashboard/portfolio']
  },
  { href: '/marketplace', icon: ShoppingBag, labelKey: 'marketplace', matchPrefixes: ['/marketplace'] }
];

export function getPortalMobileNavItems(role: SystemRole | undefined): PortalMobileNavItem[] {
  if (role === 'ADVISOR' || role === 'ADVISOR_MANAGER') {
    return advisorItems;
  }

  if (role === 'ADMIN') {
    return [];
  }

  return investorItems;
}

export function isPortalMobileNavActive(pathname: string, item: PortalMobileNavItem): boolean {
  if (item.href === '/dashboard') {
    return pathname === '/dashboard';
  }

  const prefixes = item.matchPrefixes ?? [item.href];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
