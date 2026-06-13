import { Contract, JsonRpcProvider } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { appendDeploymentEvent } from '../admin/assetsService';
import { activateCircuitBreaker } from '../admin/automationCircuitBreaker';
import { notifyAutomationIssue } from '../admin/automationAlerts';
import SanovaAssetTokenArtifact from './artifacts/SanovaAssetToken.json';
import SanovaRwaVaultArtifact from './artifacts/SanovaRwaVault.json';
import { resolveChainId } from './explorerUrls';
import { resolveChainRpcUrl } from './supportedChains';
import {
  allowedExternalContractsForChain,
  operatorCustodianPolicy,
  resolveDailyWithdrawalLimit
} from './securityPolicy';
import { resolveTreasuryAddress } from './treasuryPolicy';

function looksLikeRpcDegraded(report: {
  checks: Array<{ label: string; ok: boolean; detail: string }>;
  balances: Record<string, string | null>;
}): boolean {
  const ownerFails = report.checks.some(
    (check) =>
      check.label.includes('owner treasury') &&
      !check.ok &&
      check.detail.includes('owner() no disponible')
  );
  const allowlistChecks = report.checks.filter((check) => check.label.includes('allowlist'));
  const allAllowFail = allowlistChecks.length > 0 && allowlistChecks.every((check) => !check.ok);
  const zeroAssets = report.balances.totalAssets === '0' || report.balances.totalAssets === null;
  return ownerFails && allAllowFail && zeroAssets;
}

function ok(label: string, okValue: boolean, detail: string) {
  return { label, ok: okValue, detail };
}

export async function generateRwaSecurityReport(asset: AdminAssetRecord) {
  const chainId = asset.chainId ?? resolveChainId();
  const provider = new JsonRpcProvider(resolveChainRpcUrl(chainId));
  const treasury = resolveTreasuryAddress();
  const checks: Array<{ label: string; ok: boolean; detail: string }> = [];
  const balances: Record<string, string | null> = {
    totalAssets: null,
    treasuryShares: null,
    dailyWithdrawalLimit: null
  };

  try {
    const custody = operatorCustodianPolicy({ treasuryAddress: treasury });
    checks.push(ok('Operador/custodio separados', custody.ok, custody.message));

    if (!asset.contractAddress) {
      checks.push(ok('Token desplegado', false, 'contractAddress ausente.'));
      return { ok: false, chainId, treasury, checks, balances };
    }

    const token = new Contract(asset.contractAddress, SanovaAssetTokenArtifact.abi, provider);
    const tokenOwner = String(await token.owner().catch(() => ''));
    const tokenPaused = Boolean(await token.paused().catch(() => false));
    checks.push(ok('Token owner treasury', Boolean(treasury && tokenOwner.toLowerCase() === treasury.toLowerCase()), tokenOwner || 'owner() no disponible'));
    checks.push(ok('Token no pausado', !tokenPaused, tokenPaused ? 'Token pausado.' : 'Activo.'));

    for (const address of allowedExternalContractsForChain(chainId)) {
      const allowed = Boolean(await token.externalContractAllowed(address).catch(() => false));
      checks.push(ok(`Token allowlist ${address.slice(0, 8)}...`, allowed, allowed ? 'Permitido.' : 'No permitido.'));
    }

    if (asset.vaultAddress) {
      const vault = new Contract(asset.vaultAddress, SanovaRwaVaultArtifact.abi, provider);
      const vaultOwner = String(await vault.owner().catch(() => ''));
      const vaultPaused = Boolean(await vault.paused().catch(() => false));
      const totalAssets = BigInt(await vault.totalAssets().catch(() => 0n));
      const treasuryShares = treasury ? BigInt(await vault.balanceOf(treasury).catch(() => 0n)) : 0n;
      const dailyWithdrawalLimit = BigInt(await vault.dailyWithdrawalLimit().catch(() => 0n));
      const expectedLimit = resolveDailyWithdrawalLimit(totalAssets);

      balances.totalAssets = totalAssets.toString();
      balances.treasuryShares = treasuryShares.toString();
      balances.dailyWithdrawalLimit = dailyWithdrawalLimit.toString();

      checks.push(ok('Vault owner treasury', Boolean(treasury && vaultOwner.toLowerCase() === treasury.toLowerCase()), vaultOwner || 'owner() no disponible'));
      checks.push(ok('Vault no pausado', !vaultPaused, vaultPaused ? 'Vault pausado.' : 'Activo.'));
      checks.push(ok('Treasury mantiene shares', treasuryShares > 0n, `${treasuryShares.toString()} shares`));
      checks.push(ok('Límite diario configurado', dailyWithdrawalLimit > 0n && dailyWithdrawalLimit <= expectedLimit, `limit=${dailyWithdrawalLimit.toString()} expectedMax=${expectedLimit.toString()}`));

      for (const address of allowedExternalContractsForChain(chainId)) {
        const allowed = Boolean(await vault.externalContractAllowed(address).catch(() => false));
        checks.push(ok(`Vault allowlist ${address.slice(0, 8)}...`, allowed, allowed ? 'Permitido.' : 'No permitido.'));
      }
    }

    const reportOk = checks.every((check) => check.ok);
    return { ok: reportOk, chainId, treasury, checks, balances };
  } finally {
    provider.destroy();
  }
}

export async function recordRwaSecurityReport(asset: AdminAssetRecord, options: { activateBreaker?: boolean } = {}) {
  const report = await generateRwaSecurityReport(asset);
  const failures = report.checks.filter((check) => !check.ok);
  await appendDeploymentEvent(asset.id, {
    step: 'SECURITY_REPORT',
    status: report.ok ? 'SUCCESS' : 'FAILED',
    message: failures.length
      ? `Security report falló: ${failures.map((entry) => entry.label).join(', ')}`
      : 'Security report OK.',
    externalId: JSON.stringify({
      chainId: report.chainId,
      balances: report.balances,
      failures: failures.map((entry) => ({ label: entry.label, detail: entry.detail }))
    })
  });

  await appendDeploymentEvent(asset.id, {
    step: 'BALANCE_MONITOR',
    status: report.ok ? 'SUCCESS' : 'FAILED',
    message: `totalAssets=${report.balances.totalAssets ?? 'n/a'} treasuryShares=${report.balances.treasuryShares ?? 'n/a'} dailyLimit=${report.balances.dailyWithdrawalLimit ?? 'n/a'}`
  });

  if (!report.ok) {
    const rpcDegraded = looksLikeRpcDegraded(report);
    await notifyAutomationIssue({
      projectId: asset.id,
      title: asset.title,
      message: rpcDegraded
        ? `Security report degradado (posible límite RPC): ${failures.map((entry) => `${entry.label}: ${entry.detail}`).join('\n')}`
        : failures.map((entry) => `${entry.label}: ${entry.detail}`).join('\n'),
      severity: rpcDegraded ? 'warning' : 'critical'
    });
    if (options.activateBreaker && !rpcDegraded) {
      await activateCircuitBreaker(asset.id, 'Anomalías on-chain detectadas por security report.');
    }
  }

  return report;
}
