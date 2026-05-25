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

export function getMarketplaceCapabilities(role: SystemRole | undefined): MarketplaceCapabilities {
  switch (role) {
    case 'ADMIN':
      return {
        showBorrowRates: true,
        showPurchaseActions: false,
        useInvestorKycStatus: false,
        showAdminToolbar: true,
        subtitleKey: 'admin'
      };
    case 'ADVISOR':
      return {
        showBorrowRates: false,
        showPurchaseActions: false,
        useInvestorKycStatus: false,
        showAdminToolbar: false,
        subtitleKey: 'advisor'
      };
    case 'ADVISOR_MANAGER':
      return {
        showBorrowRates: false,
        showPurchaseActions: false,
        useInvestorKycStatus: false,
        showAdminToolbar: false,
        subtitleKey: 'advisorManager'
      };
    case 'INVESTOR':
      return {
        showBorrowRates: false,
        showPurchaseActions: true,
        useInvestorKycStatus: true,
        showAdminToolbar: false,
        subtitleKey: 'investor'
      };
    default:
      return {
        showBorrowRates: false,
        showPurchaseActions: false,
        useInvestorKycStatus: false,
        showAdminToolbar: false,
        subtitleKey: 'default'
      };
  }
}
