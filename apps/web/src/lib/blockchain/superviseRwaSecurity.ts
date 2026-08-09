import type { AdminAssetRecord } from '../admin/assetsService';
import { notifyAutomationIssue } from '../admin/automationAlerts';
import { activateCircuitBreaker, resetCircuitBreaker } from '../admin/automationCircuitBreaker';
import { describeBaseRpc } from './baseRpc';
import { repairRwaSecurityConfig } from './repairRwaSecurityConfig';
import { recordRwaSecurityReport, type SecurityCheck } from './rwaSecurityReport';
import { isTreasuryOwnerSignerConfigured } from './treasuryOwnerSigner';

/**
 * Findings `repairRwaSecurityConfig` knows how to converge on its own: allowing
 * an address the policy already declares, and lowering the daily withdrawal
 * limit to the policy maximum. Both are strictly tightening — the repair can
 * never disallow an address, raise a limit, pause, or change an owner.
 */
const REPAIRABLE_LABELS = ['allowlist', 'Límite diario'];

export function isRepairableFailure(label: string): boolean {
  return REPAIRABLE_LABELS.some((needle) => label.includes(needle));
}

export type BreakerDecision = 'activate' | 'release' | 'unchanged';

/**
 * Decide whether the asset should stay blocked.
 *
 * The breaker used to fire on any confirmed failure, including ones the platform
 * was about to fix itself. Blocking an asset whose repair is already scheduled
 * on-chain punishes it for a 24-hour wait nobody can shorten, so a finding that
 * is both repairable and in flight is not grounds to block. Anything the repair
 * cannot touch — a paused vault, an owner that is not the treasury — still is.
 */
export function decideBreaker(input: {
  failures: Pick<SecurityCheck, 'label'>[];
  repairInFlight: boolean;
  breakerActive: boolean;
  reportClean: boolean;
}): BreakerDecision {
  if (input.reportClean) {
    return input.breakerActive ? 'release' : 'unchanged';
  }

  const unfixable = input.failures.filter((failure) => !isRepairableFailure(failure.label));
  if (unfixable.length > 0) {
    return input.breakerActive ? 'unchanged' : 'activate';
  }

  if (input.failures.length > 0 && !input.repairInFlight) {
    return input.breakerActive ? 'unchanged' : 'activate';
  }

  return 'unchanged';
}

export function rwaSecurityAutoRepairEnabled(): boolean {
  const flag = process.env.RWA_SECURITY_AUTOREPAIR?.trim().toLowerCase();
  if (flag === 'false' || flag === '0') return false;
  return isTreasuryOwnerSignerConfigured();
}

/**
 * One message per asset per run, saying what is wrong, what the platform did
 * about it, and what it is waiting on. The previous alert only had the first
 * part, which is why the same finding arrived every morning looking untouched.
 */
async function notifySupervision(input: {
  asset: AdminAssetRecord;
  report: { ok: boolean; degraded: boolean; failures: SecurityCheck[]; unknowns: SecurityCheck[] };
  repaired: string[];
  pending: string[];
  breaker: BreakerDecision;
  repairError?: string;
}): Promise<void> {
  const { report } = input;
  if (report.ok && input.breaker !== 'release' && input.repaired.length === 0) {
    return;
  }

  const lines: string[] = [];
  if (report.failures.length > 0) {
    lines.push(
      'Anomalías confirmadas:',
      ...report.failures.map((failure) => `  · ${failure.label}: ${failure.detail}`)
    );
  }
  if (input.repaired.length > 0) {
    lines.push('Reparación automática:', ...input.repaired.map((entry) => `  · ${entry}`));
  }
  if (input.pending.length > 0) {
    lines.push('Esperando timelock:', ...input.pending.map((entry) => `  · ${entry}`));
  }
  if (report.unknowns.length > 0) {
    const rpc = describeBaseRpc();
    lines.push(
      `No se pudo verificar (RPC): ${report.unknowns.map((entry) => entry.label).join(', ')}`,
      rpc.dedicated
        ? `RPC: ${rpc.provider} (${rpc.url ?? 'n/a'})`
        : 'RPC: endpoint público de Base (limita ráfagas de eth_call). Configurá ALCHEMY_API_KEY o BASE_RPC_URL.'
    );
  }
  if (input.repairError) {
    lines.push(`La reparación falló: ${input.repairError}`);
  }
  if (input.breaker === 'activate') {
    lines.push('La automatización de este activo queda bloqueada.');
  } else if (input.breaker === 'release') {
    lines.push('La automatización de este activo se liberó.');
  }

  const unfixable = report.failures.filter((failure) => !isRepairableFailure(failure.label));
  const severity: 'critical' | 'warning' =
    unfixable.length > 0 || input.repairError ? 'critical' : 'warning';

  await notifyAutomationIssue({
    projectId: input.asset.id,
    // El código del token lo agrega notifyAutomationIssue, para todas las alertas.
    title: input.asset.title,
    message: lines.join('\n') || 'Security report OK.',
    severity
  });
}

export type SecuritySupervisionResult = {
  projectId: string;
  ok: boolean;
  degraded: boolean;
  failures: string[];
  repaired: string[];
  pending: string[];
  breaker: BreakerDecision;
  repairError?: string;
};

/**
 * Run the daily security check and close the loop on it.
 *
 * The report on its own only ever complained: the two Añelo vaults were flagged
 * every morning for weeks with nobody able to act, because the fix needs a
 * timelocked admin action the deploy path never scheduled. Pairing the report
 * with the repair means the first run starts the clock and a later run applies
 * it, unattended.
 */
export async function superviseRwaSecurity(
  asset: AdminAssetRecord,
  options: { autoRepair?: boolean } = {}
): Promise<SecuritySupervisionResult> {
  const autoRepair = options.autoRepair ?? rwaSecurityAutoRepairEnabled();

  // Both passes stay quiet; the alert below describes where the asset ended up.
  let report = await recordRwaSecurityReport(asset, { notify: false });
  const repaired: string[] = [];
  const pending: string[] = [];
  let repairError: string | undefined;

  const repairableFailures = report.failures.filter((failure) => isRepairableFailure(failure.label));

  if (autoRepair && repairableFailures.length > 0) {
    try {
      const repair = await repairRwaSecurityConfig(asset);
      pending.push(...repair.pending);
      for (const step of repair.steps) {
        if (step.move === 'EXECUTE' || step.move === 'SCHEDULE') {
          repaired.push(`${step.contract}/${step.label}: ${step.move}`);
        }
      }
      if (repair.steps.some((step) => step.move === 'EXECUTE')) {
        report = await recordRwaSecurityReport(asset, { notify: false });
      }
    } catch (error) {
      repairError = error instanceof Error ? error.message.slice(0, 200) : 'REPAIR_FAILED';
    }
  }

  const breaker = decideBreaker({
    failures: report.failures,
    repairInFlight: pending.length > 0,
    breakerActive: asset.automationCircuitBreaker,
    reportClean: report.ok
  });

  if (breaker === 'activate') {
    await activateCircuitBreaker(asset.id, 'Anomalías on-chain detectadas por security report.');
  } else if (breaker === 'release') {
    await resetCircuitBreaker(asset.id, 'El security report volvió a dar limpio.');
  }

  await notifySupervision({ asset, report, repaired, pending, breaker, repairError });

  return {
    projectId: asset.id,
    ok: report.ok,
    degraded: report.degraded,
    failures: report.failures.map((failure) => failure.label),
    repaired,
    pending,
    breaker,
    ...(repairError ? { repairError } : {})
  };
}
