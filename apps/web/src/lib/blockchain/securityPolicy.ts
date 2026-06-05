import type { Contract } from 'ethers';
import { sendAutomationTx, waitForAutomationTx } from './automationTx';
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

export function borrowSafetyBps(): number {
  const value = Number(process.env.RWA_BORROW_SAFETY_BPS ?? '7000');
  return Number.isFinite(value) && value > 0 && value <= 10_000 ? value : 7000;
}

export function operatorCustodianPolicy(input: {
  operatorAddress?: string | null;
  treasuryAddress?: string | null;
}) {
  const operator = process.env.RWA_OPERATOR_ADDRESS?.trim() || input.operatorAddress || null;
  const custodian = input.treasuryAddress || process.env.TOKEN_TREASURY_ADDRESS?.trim() || process.env.SANOVA_TREASURY_ADDRESS?.trim() || null;
  const production = process.env.NODE_ENV === 'production';

  if (!operator || !custodian) {
    return {
      ok: !production,
      operator,
      custodian,
      message: production
        ? 'Operador y custodio son obligatorios en producción.'
        : 'Operador/custodio incompletos permitidos solo fuera de producción.'
    };
  }

  if (operator.toLowerCase() === custodian.toLowerCase()) {
    return {
      ok: false,
      operator,
      custodian,
      message: 'Operador y custodio no pueden ser la misma address.'
    };
  }

  return {
    ok: true,
    operator,
    custodian,
    message: 'Operador separado del custodio/Safe.'
  };
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

  const wallet = input.asset.runner;

  for (const address of allowed) {
    try {
      const assetAllowed = await input.asset.externalContractAllowed(address);
      if (!assetAllowed) {
        await input.asset.setExternalContractAllowed.staticCall(address, true);
        const assetTx = await sendAutomationTx(() => input.asset.setExternalContractAllowed(address, true), wallet);
        await waitForAutomationTx(assetTx);
      }
      if (input.vaultContract) {
        const vaultAllowed = await input.vaultContract.externalContractAllowed(address);
        if (!vaultAllowed) {
          await input.vaultContract.setExternalContractAllowed.staticCall(address, true);
          const vaultTx = await sendAutomationTx(
            () => input.vaultContract!.setExternalContractAllowed(address, true),
            wallet
          );
          await waitForAutomationTx(vaultTx);
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'allow failed';
      throw new Error(`setExternalContractAllowed(${address}) falló: ${detail}`);
    }
  }

  if (input.vaultContract) {
    try {
      const limit = resolveDailyWithdrawalLimit(input.totalAssets);
      const currentLimit = await input.vaultContract.dailyWithdrawalLimit();
      if (currentLimit > limit) {
        await input.vaultContract.setDailyWithdrawalLimit.staticCall(limit);
        const limitTx = await sendAutomationTx(() => input.vaultContract!.setDailyWithdrawalLimit(limit), wallet);
        await waitForAutomationTx(limitTx);
      }
    } catch {
      // Non-fatal: vault defaults to unlimited withdrawals during the 1h bootstrap window.
    }
  }

  return { allowedContracts: allowed };
}
