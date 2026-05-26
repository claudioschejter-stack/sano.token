import type { Contract } from 'ethers';
import { waitForAutomationTx } from './automationTx';
import { getLendingChainConfig } from '../lending/baseContracts';

function parseAddressList(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^0x[a-fA-F0-9]{40}$/.test(entry));
}

export function allowedExternalContracts(): string[] {
  const lending = getLendingChainConfig();
  return Array.from(
    new Set([
      lending.morpho,
      lending.usdc,
      lending.morphoIrm,
      ...parseAddressList(process.env.RWA_ALLOWED_EXTERNAL_CONTRACTS)
    ].map((address) => address.toLowerCase()))
  );
}

export function resolveDailyWithdrawalLimit(totalAssets: bigint): bigint {
  const bps = BigInt(Number(process.env.RWA_DAILY_WITHDRAWAL_LIMIT_BPS ?? '1000'));
  if (bps <= 0n || bps > 10_000n) {
    return totalAssets / 10n;
  }
  return (totalAssets * bps) / 10_000n;
}

export function maxBorrowUsdPerProject(): number {
  const value = Number(process.env.RWA_MAX_DAILY_BORROW_USD ?? '250000');
  return Number.isFinite(value) && value > 0 ? value : 250000;
}

export async function configureInitialContractSecurity(input: {
  asset: Contract;
  vaultContract?: Contract | null;
  treasuryAddress: string;
  totalAssets: bigint;
  extraAllowedContracts?: string[];
}) {
  const allowed = Array.from(
    new Set([
      input.treasuryAddress.toLowerCase(),
      ...allowedExternalContracts(),
      ...(input.extraAllowedContracts ?? []).map((address) => address.toLowerCase())
    ])
  );

  for (const address of allowed) {
    const assetTx = await input.asset.setExternalContractAllowed(address, true);
    await waitForAutomationTx(assetTx);
    if (input.vaultContract) {
      const vaultTx = await input.vaultContract.setExternalContractAllowed(address, true);
      await waitForAutomationTx(vaultTx);
    }
  }

  if (input.vaultContract) {
    const limit = resolveDailyWithdrawalLimit(input.totalAssets);
    const limitTx = await input.vaultContract.setDailyWithdrawalLimit(limit);
    await waitForAutomationTx(limitTx);
  }

  return { allowedContracts: allowed };
}
