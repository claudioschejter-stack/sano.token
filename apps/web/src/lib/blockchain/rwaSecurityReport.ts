import { Contract, JsonRpcProvider } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { appendDeploymentEvent } from '../admin/assetsService';
import { activateCircuitBreaker } from '../admin/automationCircuitBreaker';
import { notifyAutomationIssue } from '../admin/automationAlerts';
import SanovaAssetTokenArtifact from './artifacts/SanovaAssetToken.json';
import SanovaRwaVaultArtifact from './artifacts/SanovaRwaVault.json';
import { resolveChainId } from './explorerUrls';
import { readWithRetry } from './rpcRetry';
import { resolveChainRpcUrl } from './supportedChains';
import {
  allowedExternalContractsForChain,
  operatorCustodianPolicy,
  resolveDailyWithdrawalLimit
} from './securityPolicy';
import { resolveTreasuryAddress } from './treasuryPolicy';

export const UINT256_MAX = (1n << 256n) - 1n;

/**
 * A check is either satisfied, genuinely violated, or unreadable.
 *
 * The three used to collapse into a boolean: every read was wrapped in
 * `.catch(() => false)`, so a throttled `eth_call` produced the same finding as
 * a contract that really had the address disallowed. The report then said "No
 * permitido" about an address nobody had touched, and the circuit breaker
 * blocked the asset's automation on the strength of it. A daily alert that can
 * be wrong that way is worse than no alert: the real findings arrive in the same
 * envelope as the noise.
 */
export type SecurityCheckStatus = 'ok' | 'fail' | 'unknown';

export type SecurityCheck = {
  label: string;
  /** Kept for callers that only ask "is this clean"; `unknown` is not clean. */
  ok: boolean;
  status: SecurityCheckStatus;
  detail: string;
};

function pass(label: string, detail: string): SecurityCheck {
  return { label, ok: true, status: 'ok', detail };
}

function violated(label: string, detail: string): SecurityCheck {
  return { label, ok: false, status: 'fail', detail };
}

function unreadable(label: string, detail = 'No se pudo leer on-chain (RPC).'): SecurityCheck {
  return { label, ok: false, status: 'unknown', detail };
}

/** `null` means the read failed; `false` means the contract answered "no". */
function fromRead(
  label: string,
  value: boolean | null,
  detail: { ok: string; fail: string }
): SecurityCheck {
  if (value === null) return unreadable(label);
  return value ? pass(label, detail.ok) : violated(label, detail.fail);
}

function describeDailyLimit(limit: bigint, expectedMax: bigint): string {
  const expected = `esperado <= ${expectedMax.toString()}`;
  if (limit === UINT256_MAX) {
    return `sin límite (uint256 max, valor inicial del contrato); ${expected}`;
  }
  return `limit=${limit.toString()} ${expected}`;
}

export async function generateRwaSecurityReport(asset: AdminAssetRecord) {
  const chainId = asset.chainId ?? resolveChainId();
  const provider = new JsonRpcProvider(resolveChainRpcUrl(chainId));
  const treasury = resolveTreasuryAddress();
  const checks: SecurityCheck[] = [];
  const balances: Record<string, string | null> = {
    totalAssets: null,
    treasuryShares: null,
    dailyWithdrawalLimit: null
  };

  try {
    const custody = operatorCustodianPolicy({ treasuryAddress: treasury });
    checks.push(
      custody.ok ? pass('Operador/custodio separados', custody.message) : violated('Operador/custodio separados', custody.message)
    );

    if (!asset.contractAddress) {
      checks.push(violated('Token desplegado', 'contractAddress ausente.'));
      return summarize({ chainId, treasury, checks, balances });
    }

    const token = new Contract(asset.contractAddress, SanovaAssetTokenArtifact.abi, provider);
    const tokenOwner = await readWithRetry(() => token.owner() as Promise<string>);
    const tokenPaused = await readWithRetry(() => token.paused() as Promise<boolean>);

    checks.push(
      tokenOwner === null
        ? unreadable('Token owner treasury', 'owner() no disponible (RPC).')
        : fromRead(
            'Token owner treasury',
            Boolean(treasury && String(tokenOwner).toLowerCase() === treasury.toLowerCase()),
            { ok: String(tokenOwner), fail: `owner=${String(tokenOwner)} treasury=${treasury ?? 'n/a'}` }
          )
    );
    checks.push(
      tokenPaused === null
        ? unreadable('Token no pausado')
        : fromRead('Token no pausado', !tokenPaused, { ok: 'Activo.', fail: 'Token pausado.' })
    );

    for (const address of allowedExternalContractsForChain(chainId)) {
      const allowed = await readWithRetry(() => token.externalContractAllowed(address) as Promise<boolean>);
      checks.push(
        fromRead(`Token allowlist ${address.slice(0, 8)}...`, allowed, {
          ok: 'Permitido.',
          fail: 'No permitido.'
        })
      );
    }

    if (asset.vaultAddress) {
      const vault = new Contract(asset.vaultAddress, SanovaRwaVaultArtifact.abi, provider);
      const vaultOwner = await readWithRetry(() => vault.owner() as Promise<string>);
      const vaultPaused = await readWithRetry(() => vault.paused() as Promise<boolean>);
      const totalAssets = await readWithRetry(() => vault.totalAssets() as Promise<bigint>);
      const treasuryShares = treasury
        ? await readWithRetry(() => vault.balanceOf(treasury) as Promise<bigint>)
        : 0n;
      const dailyWithdrawalLimit = await readWithRetry(
        () => vault.dailyWithdrawalLimit() as Promise<bigint>
      );

      balances.totalAssets = totalAssets === null ? null : totalAssets.toString();
      balances.treasuryShares = treasuryShares === null ? null : treasuryShares.toString();
      balances.dailyWithdrawalLimit =
        dailyWithdrawalLimit === null ? null : dailyWithdrawalLimit.toString();

      checks.push(
        vaultOwner === null
          ? unreadable('Vault owner treasury', 'owner() no disponible (RPC).')
          : fromRead(
              'Vault owner treasury',
              Boolean(treasury && String(vaultOwner).toLowerCase() === treasury.toLowerCase()),
              { ok: String(vaultOwner), fail: `owner=${String(vaultOwner)} treasury=${treasury ?? 'n/a'}` }
            )
      );
      checks.push(
        vaultPaused === null
          ? unreadable('Vault no pausado')
          : fromRead('Vault no pausado', !vaultPaused, { ok: 'Activo.', fail: 'Vault pausado.' })
      );
      checks.push(
        treasuryShares === null
          ? unreadable('Treasury mantiene shares')
          : fromRead('Treasury mantiene shares', treasuryShares > 0n, {
              ok: `${treasuryShares.toString()} shares`,
              fail: 'Treasury sin shares del vault.'
            })
      );

      if (dailyWithdrawalLimit === null || totalAssets === null) {
        checks.push(unreadable('Límite diario configurado'));
      } else {
        const expectedMax = resolveDailyWithdrawalLimit(totalAssets);
        checks.push(
          fromRead(
            'Límite diario configurado',
            dailyWithdrawalLimit > 0n && dailyWithdrawalLimit <= expectedMax,
            {
              ok: describeDailyLimit(dailyWithdrawalLimit, expectedMax),
              fail: describeDailyLimit(dailyWithdrawalLimit, expectedMax)
            }
          )
        );
      }

      for (const address of allowedExternalContractsForChain(chainId)) {
        const allowed = await readWithRetry(
          () => vault.externalContractAllowed(address) as Promise<boolean>
        );
        checks.push(
          fromRead(`Vault allowlist ${address.slice(0, 8)}...`, allowed, {
            ok: 'Permitido.',
            fail: 'No permitido.'
          })
        );
      }
    }

    return summarize({ chainId, treasury, checks, balances });
  } finally {
    provider.destroy();
  }
}

function summarize(input: {
  chainId: number;
  treasury: string | null;
  checks: SecurityCheck[];
  balances: Record<string, string | null>;
}) {
  const failures = input.checks.filter((check) => check.status === 'fail');
  const unknowns = input.checks.filter((check) => check.status === 'unknown');
  return {
    ok: failures.length === 0 && unknowns.length === 0,
    /** Something could not be read, so the report cannot clear the asset either. */
    degraded: unknowns.length > 0,
    chainId: input.chainId,
    treasury: input.treasury,
    checks: input.checks,
    failures,
    unknowns,
    balances: input.balances
  };
}

export async function recordRwaSecurityReport(
  asset: AdminAssetRecord,
  options: {
    activateBreaker?: boolean;
    /**
     * Callers that report, repair and then re-check would send one alert per
     * pass, including one about a finding they fixed seconds later. They send
     * their own, once, describing the final state.
     */
    notify?: boolean;
  } = {}
) {
  const report = await generateRwaSecurityReport(asset);
  const { failures, unknowns } = report;

  await appendDeploymentEvent(asset.id, {
    step: 'SECURITY_REPORT',
    status: report.ok ? 'SUCCESS' : 'FAILED',
    message: failures.length
      ? `Security report falló: ${failures.map((entry) => entry.label).join(', ')}`
      : unknowns.length
        ? `Security report incompleto (RPC): ${unknowns.map((entry) => entry.label).join(', ')}`
        : 'Security report OK.',
    externalId: JSON.stringify({
      chainId: report.chainId,
      balances: report.balances,
      failures: failures.map((entry) => ({ label: entry.label, detail: entry.detail })),
      unreadable: unknowns.map((entry) => entry.label)
    })
  });

  await appendDeploymentEvent(asset.id, {
    step: 'BALANCE_MONITOR',
    status: report.ok ? 'SUCCESS' : 'FAILED',
    message: `totalAssets=${report.balances.totalAssets ?? 'n/a'} treasuryShares=${report.balances.treasuryShares ?? 'n/a'} dailyLimit=${report.balances.dailyWithdrawalLimit ?? 'n/a'}`
  });

  if (!report.ok) {
    const lines = [
      ...failures.map((entry) => `${entry.label}: ${entry.detail}`),
      ...(unknowns.length
        ? [`No se pudo verificar (RPC): ${unknowns.map((entry) => entry.label).join(', ')}`]
        : [])
    ];

    if (options.notify !== false) {
      await notifyAutomationIssue({
        projectId: asset.id,
        title: asset.title,
        message: failures.length
          ? lines.join('\n')
          : `Security report incompleto por lecturas RPC fallidas, sin anomalías confirmadas.\n${lines.join('\n')}`,
        severity: failures.length ? 'critical' : 'warning'
      });
    }

    // Only a confirmed on-chain anomaly may block the asset. An unreadable
    // contract is a problem with our RPC, not with the asset.
    if (options.activateBreaker && failures.length > 0) {
      await activateCircuitBreaker(asset.id, 'Anomalías on-chain detectadas por security report.');
    }
  }

  return report;
}
