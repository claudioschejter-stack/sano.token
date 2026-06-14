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

const CASH_FLOW_CONCEPT_BY_CODE: Record<string, keyof Messages['demo']['cashFlowConcepts']> = {
  OPERATING_DIVIDEND_USDC: 'operatingDividendUsdc',
  OPERATING_DIVIDEND_FIAT: 'operatingDividendFiat',
  DIVIDEND_APPLIED_TO_MARGIN: 'dividendAppliedToMargin'
};

const CASH_FLOW_STATUS_BY_CODE: Record<string, keyof Messages['status']> = {
  LIQUIDATED_CASH: 'liquidatedCash',
  LIQUIDATED_FIAT: 'liquidatedFiat',
  APPLIED_TO_MARGIN: 'appliedToMargin'
};

export function translateLiquidatedStatus(
  statusCode: string,
  fallback: string,
  t: Messages
): string {
  const key = CASH_FLOW_STATUS_BY_CODE[statusCode];
  if (key) {
    return t.status[key];
  }

  if (
    fallback === 'Liquidado en Efectivo' ||
    fallback === 'Liquidated in cash' ||
    fallback === 'LIQUIDATED_CASH'
  ) {
    return t.status.liquidatedCash;
  }

  if (fallback === 'LIQUIDATED_FIAT' || fallback === 'Acreditado en billetera Sanova') {
    return t.status.liquidatedFiat;
  }

  if (fallback === 'APPLIED_TO_MARGIN' || fallback === 'Aplicado a margen') {
    return t.status.appliedToMargin;
  }

  return fallback;
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

export function translateCashFlowConcept(
  conceptCode: string,
  fallback: string,
  t: Messages
): string {
  const key = CASH_FLOW_CONCEPT_BY_CODE[conceptCode];
  if (key) {
    return t.demo.cashFlowConcepts[key];
  }

  return fallback;
}
