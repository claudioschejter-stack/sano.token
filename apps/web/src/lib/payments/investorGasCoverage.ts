import { roundUsdc } from './formatUsdPrecise';

/**
 * Flat USDC amount the investor pays on top of the investment to cover **every**
 * on-chain step their purchase triggers, not just their own transfer:
 *
 * 1. USDC transfer to treasury (paymaster fee, charged by Privy)
 * 2. `setKyc(wallet, true)` whitelisting on the asset token
 * 3. Vault share delivery from treasury to their wallet
 *
 * Steps 2 and 3 are signed by Sanova wallets, so without this the platform
 * absorbed the gas of an investor-driven movement.
 */
export const DEFAULT_INVESTOR_GAS_COVERAGE_USD = 0.032;

export function investorGasCoverageUsd(): number {
  const raw = process.env.RWA_INVESTOR_GAS_COVERAGE_USD?.trim();
  if (!raw) return DEFAULT_INVESTOR_GAS_COVERAGE_USD;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_INVESTOR_GAS_COVERAGE_USD;
  return value;
}

export type SettlementCharges = {
  investmentUsd: number;
  /** Live paymaster/network estimate for the investor's own transfer. */
  paymasterFeeUsd: number;
  /** Flat coverage for platform-signed steps (whitelist + share delivery). */
  coverageUsd: number;
  /** Single gas line shown to the investor. */
  networkFeeUsd: number;
  /** USDC actually sent to treasury: investment + coverage. */
  treasuryTransferUsd: number;
  /** Wallet balance the investor needs. */
  payableUsdc: number;
};

/**
 * Split a purchase into what reaches treasury and what gas costs.
 * The coverage travels **with** the payment so treasury is reimbursed for the
 * gas it will spend delivering the tokens.
 */
export function buildSettlementCharges(input: {
  investmentUsd: number;
  paymasterFeeUsd: number;
  coverageUsd?: number;
}): SettlementCharges {
  const investmentUsd = roundUsdc(Math.max(0, input.investmentUsd));
  const paymasterFeeUsd = roundUsdc(Math.max(0, input.paymasterFeeUsd));
  const coverageUsd = roundUsdc(Math.max(0, input.coverageUsd ?? investorGasCoverageUsd()));

  const treasuryTransferUsd = roundUsdc(investmentUsd + coverageUsd);
  const networkFeeUsd = roundUsdc(paymasterFeeUsd + coverageUsd);

  return {
    investmentUsd,
    paymasterFeeUsd,
    coverageUsd,
    networkFeeUsd,
    treasuryTransferUsd,
    payableUsdc: roundUsdc(investmentUsd + networkFeeUsd)
  };
}
