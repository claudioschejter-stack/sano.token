import type { Messages } from './locales/en';

const DISTRIBUTION_CONCEPT_BY_ID: Record<string, keyof Messages['demo']['concepts']> = {
  'div-anelo-2026-05': 'aneloYield',
  'motion-2026-04': 'aneloAmortization',
  'div-tolhuin-2026-03': 'tolhuinDividend',
  'motion-2026-02': 'debtServiceCoverage',
  'div-mendoza-2026-01': 'mendozaQuarterly'
};

const ASSET_ID_KEYS: Record<string, keyof Messages['demo']['assets']> = {
  'Operaciones Añelo': 'aneloOps',
  Tolhuin: 'tolhuin',
  Mendoza: 'mendoza'
};

const CASH_FLOW_CONCEPT_BY_ID: Record<string, keyof Messages['demo']['cashFlowConcepts']> = {
  'cf-tolhuin-001': 'tolhuinDividend',
  'cf-mendoza-001': 'mendozaQuarterly'
};

export function translateLiquidatedStatus(status: string, t: Messages): string {
  if (
    status === 'Liquidado en Efectivo' ||
    status === 'Liquidated in cash' ||
    status === 'LIQUIDATED_CASH'
  ) {
    return t.status.liquidatedCash;
  }

  if (status === 'LIQUIDATED_FIAT') {
    return t.status.liquidatedFiat;
  }

  return status;
}

export function translateDistributionConcept(id: string, fallback: string, t: Messages): string {
  if (fallback.includes('tiempo real') || fallback.includes('real time') || fallback.includes('SSE')) {
    return t.demo.concepts.liveDistribution;
  }

  const key = DISTRIBUTION_CONCEPT_BY_ID[id];
  return key ? t.demo.concepts[key] : fallback;
}

export function translateAssetLabel(assetId: string, t: Messages): string {
  const key = ASSET_ID_KEYS[assetId];
  return key ? t.demo.assets[key] : assetId;
}

export function translateCashFlowConcept(id: string, fallback: string, t: Messages): string {
  const key = CASH_FLOW_CONCEPT_BY_ID[id];
  return key ? t.demo.cashFlowConcepts[key] : fallback;
}
