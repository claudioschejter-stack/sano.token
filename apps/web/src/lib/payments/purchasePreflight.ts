import { Contract, JsonRpcProvider, formatUnits, getAddress, isAddress } from 'ethers';
import { prisma } from '@sanova/database';
import { usdcDecimals, usdcTokenAddress } from './paymentConfig';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';
import { readWithRetry } from '../blockchain/rpcRetry';
import { readKycTimelock } from '../blockchain/scheduleTokenKyc';
import {
  deliveryOperatorModuleAddress,
  moduleCanDeliver
} from '../blockchain/deliveryOperatorModule';
import { resolveRwaOperatorAddressEnv } from '../privy/config';
import { readVaultShareDecimals, vaultSharesForTokens } from '../blockchain/vaultShareUnits';

/**
 * Every condition a purchase needs, checked before charging anybody.
 *
 * A purchase touches the investor's balance, the token's whitelist, the Safe's
 * share balance and a module's permissions, and any one of them fails deep
 * inside settlement with an error that describes the symptom rather than the
 * cause. Checking them together turns a test purchase into a checklist, and
 * more importantly stops the money moving when something downstream would have
 * blocked delivery anyway.
 */

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export type PreflightCheck = {
  id: string;
  ok: boolean;
  detail: string;
  /** What to do about it, when it is not ok. */
  fix?: string;
};

export type PurchasePreflight = {
  projectId: string;
  projectTitle: string;
  investorWallet: string;
  tokenCount: number;
  amountUsd: number;
  canPurchase: boolean;
  checks: PreflightCheck[];
};

function rpcUrl(): string {
  return (
    process.env.BASE_RPC_URL?.trim() ||
    process.env.LENDING_BASE_RPC_URL?.trim() ||
    'https://mainnet.base.org'
  );
}

export async function purchasePreflight(input: {
  projectId: string;
  investorWallet: string;
  tokenCount: number;
}): Promise<PurchasePreflight | { error: string }> {
  if (!isAddress(input.investorWallet)) {
    return { error: 'INVALID_INVESTOR_WALLET' };
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true,
      title: true,
      contractAddress: true,
      vaultAddress: true,
      availableTokens: true,
      pricePerToken: true,
      isActive: true
    }
  });
  if (!project) {
    return { error: 'PROJECT_NOT_FOUND' };
  }

  const wallet = getAddress(input.investorWallet);
  const tokenCount = Math.max(1, Math.trunc(input.tokenCount));
  const amountUsd = Number(project.pricePerToken) * tokenCount;
  const checks: PreflightCheck[] = [];

  const provider = new JsonRpcProvider(rpcUrl());
  try {
    checks.push({
      id: 'project_active',
      ok: project.isActive,
      detail: project.isActive ? 'activo' : 'inactivo',
      fix: 'Activá el proyecto en el panel de admin.'
    });

    checks.push({
      id: 'supply_available',
      ok: project.availableTokens >= tokenCount,
      detail: `${project.availableTokens} disponibles, se piden ${tokenCount}`,
      fix: 'Liberá reservas vencidas o ajustá el cupo.'
    });

    const usdc = usdcTokenAddress();
    if (usdc) {
      const balance = await readWithRetry(
        () => new Contract(usdc, ERC20_ABI, provider).balanceOf(wallet) as Promise<bigint>
      );
      const held = balance === null ? null : Number(formatUnits(balance, usdcDecimals()));
      checks.push({
        id: 'investor_usdc',
        ok: held !== null && held >= amountUsd,
        detail:
          held === null
            ? 'no se pudo leer el saldo'
            : `${held} USDC en la wallet, hacen falta ${amountUsd}`,
        fix: 'Fondeá la wallet del inversor, o usá POST /api/admin/treasury-usdc para una prueba.'
      });
    }

    const treasury = resolveTreasuryAddress();
    const vault = project.vaultAddress?.trim();

    /**
     * Sized by the vault, not by assumption: an ERC-4626 vault's share decimals
     * are the asset's plus its offset, so vaults built before and after that
     * offset was raised do not share a unit.
     */
    const shareDecimals = vault
      ? await readVaultShareDecimals({ provider, vaultAddress: vault })
      : null;
    const sharesNeeded =
      shareDecimals === null ? null : vaultSharesForTokens(tokenCount, shareDecimals);

    if (vault && shareDecimals === null) {
      checks.push({
        id: 'vault_share_decimals',
        ok: false,
        detail: 'no se pudo leer decimals() del vault',
        fix: 'Sin eso no se puede calcular cuántas shares entregar, y suponerlo entregaría una cantidad equivocada.'
      });
    }

    if (vault && treasury) {
      const shares = await readWithRetry(
        () => new Contract(vault, ERC20_ABI, provider).balanceOf(treasury) as Promise<bigint>
      );
      const readable = shares !== null && shareDecimals !== null && sharesNeeded !== null;
      checks.push({
        id: 'treasury_shares',
        ok: readable && shares >= sharesNeeded,
        detail: readable
          ? `${formatUnits(shares, shareDecimals)} shares en la tesorería`
          : 'no se pudo leer el balance de shares en las unidades del vault',
        fix: 'Revisá la entrega de shares a la tesorería en el pipeline de deploy.'
      });
    }

    /**
     * The token's whitelist is timelocked, so "not approved" can mean either
     * "waiting" or "never scheduled", and those need different actions.
     */
    if (project.contractAddress) {
      const timelock = await readKycTimelock({
        provider,
        tokenAddress: project.contractAddress,
        investorAddress: wallet
      });

      if (!timelock) {
        checks.push({
          id: 'investor_whitelisted',
          ok: false,
          detail: 'no se pudo leer el estado de KYC on-chain',
          fix: 'Revisá el RPC.'
        });
      } else if (timelock.alreadyApproved) {
        checks.push({ id: 'investor_whitelisted', ok: true, detail: 'aprobado on-chain' });
      } else if (timelock.ready) {
        checks.push({
          id: 'investor_whitelisted',
          ok: false,
          detail: 'timelock cumplido, falta ejecutar la aprobación',
          fix: 'POST /api/admin/investor-allowlist con el email del inversor.'
        });
      } else if (timelock.readyAt) {
        checks.push({
          id: 'investor_whitelisted',
          ok: false,
          detail: `timelock corriendo, aprobable desde ${new Date(timelock.readyAt * 1000).toISOString()}`,
          fix: 'Esperar. El agendado ya está hecho.'
        });
      } else {
        checks.push({
          id: 'investor_whitelisted',
          ok: false,
          detail: 'timelock sin agendar',
          fix: 'POST /api/admin/kyc-timelock con el email del inversor.'
        });
      }
    }

    /**
     * Ask the vault itself whether this exact transfer would go through.
     *
     * Every other check here reads a permission and infers the outcome, and
     * that inference is what let a purchase pass preflight and then revert on
     * delivery: the module's own `canDeliver` only knows about KYC, while the
     * vault also refuses recipients that carry code — which is every Privy
     * wallet, because they are delegated through EIP-7702. Simulating the call
     * covers that gate and any future one.
     */
    if (vault && treasury) {
      const transferData = new Contract(vault, [
        'function transfer(address,uint256) returns (bool)'
      ]).interface.encodeFunctionData('transfer', [wallet, sharesNeeded]);

      let simulation: string | null = null;
      try {
        await provider.call({ from: treasury, to: vault, data: transferData });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const revert = /execution reverted:?\s*"?([^"]*)"?/i.exec(message);
        simulation = revert?.[1]?.trim() || message.slice(0, 200);
      }

      checks.push({
        id: 'delivery_simulation',
        ok: simulation === null,
        detail: simulation === null ? 'la entrega no revierte' : `revierte: ${simulation}`,
        fix: /receiver not allowed/i.test(simulation ?? '')
          ? 'La wallet del inversor es un contrato (Privy delega vía EIP-7702) y el vault exige externalContractAllowed. Corré POST /api/admin/vault-recipient para agendar y aplicar la habilitación.'
          : 'Revisá el motivo del revert antes de cobrar: la entrega va a fallar igual.'
      });
    }

    const moduleAddress = deliveryOperatorModuleAddress();
    const operator = resolveRwaOperatorAddressEnv();
    if (moduleAddress && operator && vault) {
      const usable = await moduleCanDeliver({
        moduleAddress,
        vaultAddress: vault,
        investorAddress: wallet,
        amount: sharesNeeded,
        operatorAddress: operator,
        provider
      });
      checks.push({
        id: 'delivery_module',
        ok: usable,
        detail: usable
          ? 'el módulo puede entregar estas shares'
          : 'el módulo no puede entregar todavía (suele ser el KYC del destinatario)',
        fix: 'Confirmá el allowlist del inversor; el vault ya está habilitado en el módulo.'
      });
    } else {
      checks.push({
        id: 'delivery_module',
        ok: false,
        detail: 'módulo de entrega no configurado',
        fix: 'Definí DELIVERY_OPERATOR_MODULE_ADDRESS.'
      });
    }

    if (operator) {
      const gas = await readWithRetry(() => provider.getBalance(operator));
      const eth = gas === null ? null : Number(formatUnits(gas, 18));
      checks.push({
        id: 'operator_gas',
        ok: eth !== null && eth >= 0.0005,
        detail: eth === null ? 'no se pudo leer' : `${eth} ETH`,
        fix: 'POST /api/admin/fund-gas hacia la wallet del operador.'
      });
    }

    return {
      projectId: project.id,
      projectTitle: project.title,
      investorWallet: wallet,
      tokenCount,
      amountUsd,
      canPurchase: checks.every((check) => check.ok),
      checks
    };
  } finally {
    provider.destroy();
  }
}
