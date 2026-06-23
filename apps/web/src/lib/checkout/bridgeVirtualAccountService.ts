import type { BridgeVirtualAccountInstructions } from './paymentRouteTypes';

export type BridgeVirtualAccountInput = {
  amountUsd: number;
  referenceId: string;
  investorName?: string;
};

/**
 * MVP: simulated Bridge Virtual Account payload.
 * Replace with Bridge.xyz Customers + Virtual Accounts API when credentials are wired.
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
