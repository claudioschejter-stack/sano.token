import { create } from 'zustand';

export type CashFlowRecord = {
  id: string;
  date: string;
  assetId: string;
  conceptCode: string;
  concept: string;
  amountUsd: number;
  statusCode: string;
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
            conceptCode?: string;
            concept?: string;
            statusCode?: string;
            status?: string;
            liquidatedAmountUsd: string;
          }>;
        };

        cashFlowHistory = (cashFlowData.records ?? []).map((record) => ({
          id: record.id,
          date: record.date,
          assetId: record.assetId,
          conceptCode: record.conceptCode ?? record.concept ?? '',
          concept: record.concept ?? record.conceptCode ?? '',
          amountUsd: Number(record.liquidatedAmountUsd),
          statusCode: record.statusCode ?? record.status ?? '',
          status: record.status ?? record.statusCode ?? ''
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
  }
}));
