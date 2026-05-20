import { create } from 'zustand';

export type CashFlowRecord = {
  id: string;
  date: string;
  assetId: 'Tolhuin' | 'Mendoza';
  concept: string;
  amountUsd: number;
  status: 'Liquidado en Efectivo';
};

type PortfolioState = {
  userId: string;
  capital: number;
  marginDebt: number;
  ltv: number;
  availableCash: number;
  cashFlowHistory: CashFlowRecord[];
  isLoading: boolean;
  repaymentApplied: boolean;
  fetchPortfolio: () => void;
  applyCashToMarginRepayment: () => void;
};

const BASE_CASH_FLOW_HISTORY: CashFlowRecord[] = [
  {
    id: 'cf-tolhuin-001',
    date: '2026-05-15',
    assetId: 'Tolhuin',
    concept: 'Dividendo operativo RWA liquidado en cash',
    amountUsd: 7250,
    status: 'Liquidado en Efectivo'
  },
  {
    id: 'cf-mendoza-001',
    date: '2026-05-01',
    assetId: 'Mendoza',
    concept: 'Distribución trimestral de rendimiento en efectivo',
    amountUsd: 5250,
    status: 'Liquidado en Efectivo'
  }
];

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  userId: 'demo-investor-id',
  capital: 0,
  marginDebt: 0,
  ltv: 0,
  availableCash: 0,
  cashFlowHistory: [],
  isLoading: false,
  repaymentApplied: false,
  fetchPortfolio: () => {
    if (get().isLoading) {
      return;
    }

    set({ isLoading: true });

    setTimeout(() => {
      set((state) => {
        const marginDebt = state.repaymentApplied ? 437500 : 450000;
        const availableCash = state.repaymentApplied ? 0 : 12500;

        return {
          capital: 1250000,
          marginDebt,
          ltv: Number(((marginDebt / 1250000) * 100).toFixed(2)),
          availableCash,
          cashFlowHistory: state.repaymentApplied ? [] : BASE_CASH_FLOW_HISTORY,
          isLoading: false
        };
      });
    }, 1000);
  },
  applyCashToMarginRepayment: () => {
    set((state) => {
      const repaymentAmount = Math.min(state.availableCash, state.marginDebt);
      const marginDebt = state.marginDebt - repaymentAmount;
      const ltv = state.capital > 0 ? Number(((marginDebt / state.capital) * 100).toFixed(2)) : 0;

      return {
        availableCash: state.availableCash - repaymentAmount,
        marginDebt,
        ltv,
        cashFlowHistory: [],
        repaymentApplied: true
      };
    });
  }
}));