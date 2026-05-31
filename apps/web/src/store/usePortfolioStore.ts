import { create } from 'zustand';

export type CashFlowRecord = {
  id: string;
  date: string;
  assetId: string;
  concept: string;
  amountUsd: number;
  status: string;
};

export type PortfolioPosition = {
  id: string;
  projectId: string;
  projectTitle: string;
  tokenCount: number;
  purchasePriceUsd: string;
  purchasedAt: string;
  status: string;
  txHash?: string | null;
  vaultAddress?: string | null;
  chainId?: number | null;
  tokenSymbol?: string | null;
  currentValueUsd?: string;
  onChain?: {
    verified: boolean;
    shares: string;
    assetsUsd: string;
    walletAddress: string;
    explorerUrl: string | null;
    txExplorerUrl: string | null;
  } | null;
};

type PortfolioState = {
  userId: string;
  capital: number;
  marginDebt: number;
  ltv: number;
  availableCash: number;
  cashFlowHistory: CashFlowRecord[];
  activePositions: PortfolioPosition[];
  isLoading: boolean;
  fetchPortfolio: () => Promise<void>;
  applyCashToMarginRepayment: () => Promise<void>;
};

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  userId: '',
  capital: 0,
  marginDebt: 0,
  ltv: 0,
  availableCash: 0,
  cashFlowHistory: [],
  activePositions: [],
  isLoading: false,
  fetchPortfolio: async () => {
    if (get().isLoading) {
      return;
    }

    set({ isLoading: true });

    try {
      const [portfolioResponse, cashFlowResponse] = await Promise.all([
        fetch('/api/portfolio', { cache: 'no-store' }),
        fetch('/api/portfolio/cash-flow', { cache: 'no-store' })
      ]);

      if (!portfolioResponse.ok) {
        set({ isLoading: false });
        return;
      }

      const portfolioData = (await portfolioResponse.json()) as {
        portfolio?: {
          activePositions?: PortfolioPosition[];
        };
        summary?: {
          userId?: string;
          capital?: number;
          marginDebt?: number;
          ltv?: number;
          availableCash?: number;
        };
      };

      let cashFlowHistory: CashFlowRecord[] = [];

      if (cashFlowResponse.ok) {
        const cashFlowData = (await cashFlowResponse.json()) as {
          records?: Array<{
            id: string;
            date: string;
            assetId: string;
            concept: string;
            liquidatedAmountUsd: string;
            status: string;
          }>;
        };

        cashFlowHistory = (cashFlowData.records ?? []).map((record) => ({
          id: record.id,
          date: record.date,
          assetId: record.assetId,
          concept: record.concept,
          amountUsd: Number(record.liquidatedAmountUsd),
          status: record.status
        }));
      }

      set({
        userId: portfolioData.summary?.userId ?? '',
        capital: portfolioData.summary?.capital ?? 0,
        marginDebt: portfolioData.summary?.marginDebt ?? 0,
        ltv: portfolioData.summary?.ltv ?? 0,
        availableCash: portfolioData.summary?.availableCash ?? 0,
        activePositions: portfolioData.portfolio?.activePositions ?? [],
        cashFlowHistory,
        isLoading: false
      });
    } catch {
      set({ isLoading: false });
    }
  },
  applyCashToMarginRepayment: async () => {
    const response = await fetch('/api/portfolio/repay-margin', { method: 'POST' });

    if (!response.ok) {
      return;
    }

    await get().fetchPortfolio();
  }
}));
