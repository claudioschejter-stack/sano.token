import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

export type LiquidatedDistribution = {
  id: string;
  date: string;
  assetId: string;
  concept: string;
  amountUsdc: number;
  status: string;
  txHash?: string;
};

export type LiveDistributionEvent = Readonly<{
  txHash: string;
  amount: number;
  token: string;
  recipient: string;
  distributionId: string;
  assetId: string;
  receivedAt: string;
}>;

export type MonthlyCashFlowPoint = {
  month: string;
  dividendIncome: number;
  debtService: number;
};

type CashFlowApiRecord = {
  id: string;
  date: string;
  assetId: string;
  liquidatedAmountUsd: string;
  currency: string;
  status: string;
  concept: string;
};

type DividendState = {
  distributions: LiquidatedDistribution[];
  totalCashDividendsUsdc: number;
  debtCoveragePercent: number;
  aneloProjectedYieldPercent: number;
  monthlyComparison: MonthlyCashFlowPoint[];
  isLoading: boolean;
  lastLiveAt: string | null;
  fetchDividends: () => Promise<void>;
  addLiveDistribution: (event: LiveDistributionEvent) => void;
};

const LIQUIDATED_STATUS = 'Liquidado en Efectivo';
const MONTHLY_DEBT_SERVICE_USD = 15_000;
const ANELO_PROJECTED_YIELD_PERCENT = 9.35;

const DEMO_DISTRIBUTIONS: LiquidatedDistribution[] = [
  {
    id: 'div-anelo-2026-05',
    date: '2026-05-18T14:22:00.000Z',
    assetId: 'Operaciones Añelo',
    concept: 'Yield distribuido — tramo cash (USDC)',
    amountUsdc: 18_750,
    status: LIQUIDATED_STATUS,
    txHash: '0xanelo05…8f2c'
  },
  {
    id: 'motion-2026-04',
    date: '2026-04-12T09:10:00.000Z',
    assetId: 'Operaciones Añelo',
    concept: 'Amortización parcial indexada vía listener',
    amountUsdc: 12_400,
    status: LIQUIDATED_STATUS,
    txHash: '0xanelo04…91ab'
  },
  {
    id: 'div-tolhuin-2026-03',
    date: '2026-03-15T16:45:00.000Z',
    assetId: 'Tolhuin',
    concept: 'Dividendo operativo RWA liquidado en cash',
    amountUsdc: 7_250,
    status: LIQUIDATED_STATUS,
    txHash: '0xtolhuin03…44de'
  },
  {
    id: 'motion-2026-02',
    date: '2026-02-08T11:30:00.000Z',
    assetId: 'Operaciones Añelo',
    concept: 'Servicio de deuda — cobertura con flujo operativo',
    amountUsdc: 9_800,
    status: LIQUIDATED_STATUS,
    txHash: '0xanelo02…77c1'
  },
  {
    id: 'div-mendoza-2026-01',
    date: '2026-01-20T08:00:00.000Z',
    assetId: 'Mendoza',
    concept: 'Distribución trimestral de rendimiento en efectivo',
    amountUsdc: 5_250,
    status: LIQUIDATED_STATUS,
    txHash: '0xmendoza01…2aa0'
  }
];

const DEMO_MARGIN_DEBT_USD = 450_000;
const DEMO_AVAILABLE_CASH_USD = 53_200;

function parseUsdcAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapApiRecord(record: CashFlowApiRecord): LiquidatedDistribution {
  return {
    id: record.id,
    date: record.date,
    assetId: record.assetId,
    concept: record.concept,
    amountUsdc: parseUsdcAmount(record.liquidatedAmountUsd),
    status: record.status
  };
}

function computeDebtCoverage(totalLiquidatedUsdc: number, marginDebtUsd: number, availableCashUsd: number): number {
  if (marginDebtUsd <= 0) {
    return 100;
  }

  const coverageFromCash = (availableCashUsd / marginDebtUsd) * 100;
  const coverageFromDistributions = (totalLiquidatedUsdc / marginDebtUsd) * 100;

  return Math.min(Math.max(coverageFromCash, coverageFromDistributions), 100);
}

function buildMonthlyComparison(distributions: LiquidatedDistribution[]): MonthlyCashFlowPoint[] {
  const dividendByMonth = new Map<string, number>();

  for (const distribution of distributions) {
    const monthKey = distribution.date.slice(0, 7);
    dividendByMonth.set(monthKey, (dividendByMonth.get(monthKey) ?? 0) + distribution.amountUsdc);
  }

  const months = new Set<string>(Array.from(dividendByMonth.keys()));

  for (const distribution of distributions) {
    months.add(distribution.date.slice(0, 7));
  }

  const sortedMonths = Array.from(months).sort();

  return sortedMonths.map((monthKey) => ({
    month: monthKey,
    dividendIncome: dividendByMonth.get(monthKey) ?? 0,
    debtService: MONTHLY_DEBT_SERVICE_USD
  }));
}

function deriveStateFromDistributions(
  distributions: LiquidatedDistribution[],
  marginDebtUsd: number,
  availableCashUsd: number
): Pick<DividendState, 'distributions' | 'totalCashDividendsUsdc' | 'debtCoveragePercent' | 'monthlyComparison'> {
  const totalCashDividendsUsdc = distributions.reduce((sum, row) => sum + row.amountUsdc, 0);
  const debtCoveragePercent = computeDebtCoverage(totalCashDividendsUsdc, marginDebtUsd, availableCashUsd);

  return {
    distributions,
    totalCashDividendsUsdc,
    debtCoveragePercent: Number(debtCoveragePercent.toFixed(1)),
    monthlyComparison: buildMonthlyComparison(distributions)
  };
}

export const useDividendStore = create<DividendState>((set) => ({
  distributions: [],
  totalCashDividendsUsdc: 0,
  debtCoveragePercent: 0,
  aneloProjectedYieldPercent: ANELO_PROJECTED_YIELD_PERCENT,
  monthlyComparison: [],
  isLoading: false,
  lastLiveAt: null,
  fetchDividends: async () => {
    set({ isLoading: true });

    try {
      const records = await apiClient<CashFlowApiRecord[]>('/portfolio/cash-flow');
      const distributions = records.map(mapApiRecord);
      set({
        ...deriveStateFromDistributions(distributions, DEMO_MARGIN_DEBT_USD, DEMO_AVAILABLE_CASH_USD),
        isLoading: false
      });
    } catch {
      set({
        ...deriveStateFromDistributions(DEMO_DISTRIBUTIONS, DEMO_MARGIN_DEBT_USD, DEMO_AVAILABLE_CASH_USD),
        isLoading: false
      });
    }
  },
  addLiveDistribution: (event) =>
    set((state) => {
      if (state.distributions.some((row) => row.txHash === event.txHash)) {
        return state;
      }

      const liveRow: LiquidatedDistribution = {
        id: event.distributionId,
        date: event.receivedAt,
        assetId: event.assetId,
        concept: 'Distribución liquidada en tiempo real (SSE)',
        amountUsdc: event.amount,
        status: LIQUIDATED_STATUS,
        txHash: event.txHash
      };

      const distributions = [liveRow, ...state.distributions];

      return {
        ...deriveStateFromDistributions(distributions, DEMO_MARGIN_DEBT_USD, DEMO_AVAILABLE_CASH_USD),
        lastLiveAt: event.receivedAt
      };
    })
}));
