import type { BridgeVirtualAccountInstructions } from './paymentRouteTypes';

export type BridgeVirtualAccountInput = {
  amountUsd: number;
  referenceId: string;
  investorName?: string;
};

/**
 * Dev-only simulated Bridge Virtual Account payload.
 * Production uses Bridge.xyz Customers + Virtual Accounts via
 * `/api/payments/bridge-virtual-account` (fail-loud when API is unavailable).
 */
export function buildBridgeVirtualAccountInstructions(
  input: BridgeVirtualAccountInput
): BridgeVirtualAccountInstructions {
  const suffix = input.referenceId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'SANOVA';

  return {
    bankName: 'Lead Bank (Bridge Partner — simulated)',
    accountName: input.investorName?.trim() || 'SANOVA CAPITAL INVESTOR',
    accountNumber: '8844-2109-7721',
    routingNumber: '101019644',
    swift: 'BRDGUS33',
    beneficiaryAddress: '548 Market St, San Francisco, CA 94104, US',
    reference: input.referenceId,
    amountUsd: input.amountUsd,
    currency: 'USD',
    memo: `SANOVA-WIRE-${suffix}`,
    estimatedSettlement: '1–3 business days (ACH/Wire)'
  };
}
