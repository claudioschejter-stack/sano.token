import type { SystemRole } from '../auth/roles';

export type MarketplaceSubtitleKey =
  | 'default'
  | 'admin'
  | 'investor'
  | 'advisor'
  | 'advisorManager';

export type MarketplaceCapabilities = {
  showBorrowRates: boolean;
  showPurchaseActions: boolean;
  useInvestorKycStatus: boolean;
  showAdminToolbar: boolean;
  subtitleKey: MarketplaceSubtitleKey;
};

function tradingCapabilities(
  subtitleKey: MarketplaceSubtitleKey,
  overrides: Partial<MarketplaceCapabilities> = {}
): MarketplaceCapabilities {
  return {
    showBorrowRates: false,
    showPurchaseActions: true,
    useInvestorKycStatus: true,
    showAdminToolbar: false,
    subtitleKey,
    ...overrides
  };
}

export function getMarketplaceCapabilities(role: SystemRole | undefined): MarketplaceCapabilities {
  switch (role) {
    case 'ADMIN':
      return {
        showBorrowRates: false,
        showPurchaseActions: false,
        useInvestorKycStatus: false,
        showAdminToolbar: true,
        subtitleKey: 'admin'
      };
    case 'ADVISOR':
      return tradingCapabilities('advisor', { showBorrowRates: true });
    case 'ADVISOR_MANAGER':
      return tradingCapabilities('advisorManager', { showBorrowRates: true });
    case 'INVESTOR':
      return tradingCapabilities('investor');
    case 'TREASURY':
    case 'OPERATOR':
      return tradingCapabilities('default', { showPurchaseActions: false });
    default:
      return tradingCapabilities('default');
  }
}
