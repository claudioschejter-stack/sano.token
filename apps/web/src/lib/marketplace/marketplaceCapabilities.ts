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
      return tradingCapabilities('admin', {
        showAdminToolbar: true
      });
    case 'ADVISOR':
      return tradingCapabilities('advisor', { showPurchaseActions: false });
    case 'ADVISOR_MANAGER':
      return tradingCapabilities('advisorManager', { showPurchaseActions: false });
    case 'INVESTOR':
      return tradingCapabilities('investor');
    case 'TREASURY':
    case 'OPERATOR':
      return tradingCapabilities('default');
    default:
      return tradingCapabilities('default');
  }
}
