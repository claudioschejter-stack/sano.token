import { AbiCoder, Contract, JsonRpcProvider, getAddress, keccak256 } from 'ethers';
import type { AdminAssetRecord } from '../admin/assetsService';
import { appendDeploymentEvent } from '../admin/assetsService';
import { resolveChainId } from './explorerUrls';
import { readWithRetry } from './rpcRetry';
import { execAsOwner } from './safeExec';
import { allowedExternalContractsForChain, resolveDailyWithdrawalLimit } from './securityPolicy';
import { resolveChainRpcUrl } from './supportedChains';
import { isTreasuryOwnerSignerConfigured, resolveTreasuryOwnerSigner } from './treasuryOwnerSigner';
import { externalContractActionId } from './vaultRecipientAllowlist';

/**
 * Apply the security configuration the daily report asks for.
 *
 * `configureInitialContractSecurity` runs at deploy time and calls the setters
 * directly, which only works inside the contract's one-hour `setupExpiresAt`
 * window. After that, `setExternalContractAllowed` and `setDailyWithdrawalLimit`
 * require `scheduleAdminAction` plus a 24-hour wait — and the deploy path
 * swallowed the revert (`catch {}` for the limit, `console.warn` for non-treasury
 * allowlist entries).
 *
 * So any address added to the allowlist policy after that first hour, and every
 * vault whose limit never got lowered from the constructor's
 * `type(uint256).max`, stayed wrong forever. The report alerted about it every
 * morning and nothing in the product could act on it. This is that missing half:
 * it takes whichever step the timelock currently allows and is safe to call
 * repeatedly.
 */

const ADMIN_ABI = [
  'function owner() view returns (address)',
  'function externalContractAllowed(address) view returns (bool)',
  'function setExternalContractAllowed(address account, bool allowed)',
  'function dailyWithdrawalLimit() view returns (uint256)',
  'function setDailyWithdrawalLimit(uint256 limit)',
  'function totalAssets() view returns (uint256)',
  'function scheduleAdminAction(bytes32 actionId)',
  'function adminActionReadyAt(bytes32) view returns (uint256)',
  'function setupExpiresAt() view returns (uint256)'
];

/** Mirrors the vault's `keccak256(abi.encode("SET_DAILY_WITHDRAWAL_LIMIT", limit))`. */
export function dailyWithdrawalLimitActionId(limit: bigint): string {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(['string', 'uint256'], ['SET_DAILY_WITHDRAWAL_LIMIT', limit])
  );
}

export type TimelockGateState = {
  /** The chain already holds the value we want. */
  satisfied: boolean;
  /** Inside `setupExpiresAt`, where the contract skips the timelock entirely. */
  inSetupWindow: boolean;
  /** `adminActionReadyAt` for this exact action, or null when never scheduled. */
  readyAt: number | null;
};

export type TimelockMove = 'SKIP' | 'EXECUTE' | 'SCHEDULE' | 'WAIT';

/**
 * The step the contract will currently accept.
 *
 * Calling the setter without having scheduled it reverts with
 * "SANOVA: admin timelock pending", which is what the deploy path kept doing
 * and hiding.
 */
export function nextTimelockMove(state: TimelockGateState, nowSeconds: number): TimelockMove {
  if (state.satisfied) return 'SKIP';
  if (state.inSetupWindow) return 'EXECUTE';
  if (state.readyAt === null) return 'SCHEDULE';
  return nowSeconds >= state.readyAt ? 'EXECUTE' : 'WAIT';
}

export type SecurityRepairStep = {
  label: string;
  contract: 'token' | 'vault';
  move: TimelockMove | 'READ_FAILED' | 'FAILED' | 'NOT_APPLICABLE';
  detail: string;
  txHash?: string;
  readyAt?: number | null;
};

/**
 * The action id for the daily limit includes the amount, so a target derived
 * from live `totalAssets` changes as investors deposit — and a scheduled action
 * would never match the amount we later try to apply, rescheduling forever.
 * Targets we scheduled before are recorded and retried first.
 */
function previouslyScheduledLimits(asset: AdminAssetRecord): bigint[] {
  const out: bigint[] = [];
  for (const event of [...asset.deploymentEvents].reverse()) {
    if (event.step !== 'SECURITY_REPAIR' || !event.externalId) continue;
    try {
      const parsed = JSON.parse(event.externalId) as { dailyWithdrawalLimitTarget?: string };
      if (parsed.dailyWithdrawalLimitTarget) {
        out.push(BigInt(parsed.dailyWithdrawalLimitTarget));
      }
    } catch {
      /* event written by another writer */
    }
  }
  return out;
}

function isoOrNull(readyAt: number | null): string {
  return readyAt ? new Date(readyAt * 1000).toISOString() : 'sin programar';
}

export async function repairRwaSecurityConfig(asset: AdminAssetRecord): Promise<{
  ok: boolean;
  steps: SecurityRepairStep[];
  pending: string[];
}> {
  const steps: SecurityRepairStep[] = [];
  const pending: string[] = [];

  if (!isTreasuryOwnerSignerConfigured()) {
    return {
      ok: false,
      steps: [
        {
          label: 'Firmante del owner',
          contract: 'token',
          move: 'FAILED',
          detail: 'Falta la wallet Privy del owner del Safe (TREASURY_OWNER).'
        }
      ],
      pending: []
    };
  }

  const chainId = asset.chainId ?? resolveChainId();
  const provider = new JsonRpcProvider(resolveChainRpcUrl(chainId));

  try {
    const signer = await resolveTreasuryOwnerSigner(provider, chainId);
    if (!signer) {
      return {
        ok: false,
        steps: [
          {
            label: 'Firmante del owner',
            contract: 'token',
            move: 'FAILED',
            detail: 'No se pudo resolver el firmante del owner.'
          }
        ],
        pending: []
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const allowedAddresses = allowedExternalContractsForChain(chainId);

    const targets: Array<{ kind: 'token' | 'vault'; address: string }> = [];
    if (asset.contractAddress) targets.push({ kind: 'token', address: asset.contractAddress });
    if (asset.vaultAddress) targets.push({ kind: 'vault', address: asset.vaultAddress });

    for (const target of targets) {
      const contract = new Contract(getAddress(target.address), ADMIN_ABI, provider);
      const owner = await readWithRetry(() => contract.owner() as Promise<string>);
      const setupExpiresAtRaw = await readWithRetry(() => contract.setupExpiresAt() as Promise<bigint>);

      if (!owner) {
        steps.push({
          label: `${target.kind} owner`,
          contract: target.kind,
          move: 'READ_FAILED',
          detail: 'owner() no disponible (RPC).'
        });
        continue;
      }

      const inSetupWindow = setupExpiresAtRaw !== null && Number(setupExpiresAtRaw) > now;
      const runStep = async (input: {
        label: string;
        satisfied: boolean;
        actionId: string;
        callData: string;
      }): Promise<void> => {
        const readyAtRaw = await readWithRetry(
          () => contract.adminActionReadyAt(input.actionId) as Promise<bigint>
        );
        const readyAt = readyAtRaw === null || readyAtRaw === 0n ? null : Number(readyAtRaw);
        const move = nextTimelockMove(
          { satisfied: input.satisfied, inSetupWindow, readyAt },
          now
        );

        if (move === 'SKIP') {
          steps.push({ label: input.label, contract: target.kind, move, detail: 'Ya configurado.' });
          return;
        }

        if (move === 'WAIT') {
          pending.push(`${input.label}: aplicable desde ${isoOrNull(readyAt)}`);
          steps.push({
            label: input.label,
            contract: target.kind,
            move,
            detail: `Timelock pendiente hasta ${isoOrNull(readyAt)}.`,
            readyAt
          });
          return;
        }

        const data =
          move === 'SCHEDULE'
            ? contract.interface.encodeFunctionData('scheduleAdminAction', [input.actionId])
            : input.callData;

        try {
          const txHash = await execAsOwner({
            owner: getAddress(owner),
            signer,
            target: getAddress(target.address),
            data
          });
          if (move === 'SCHEDULE') {
            pending.push(`${input.label}: timelock iniciado`);
          }
          steps.push({
            label: input.label,
            contract: target.kind,
            move,
            detail: move === 'SCHEDULE' ? 'Timelock programado.' : 'Aplicado on-chain.',
            txHash
          });
        } catch (error) {
          steps.push({
            label: input.label,
            contract: target.kind,
            move: 'FAILED',
            detail: error instanceof Error ? error.message.slice(0, 200) : 'tx falló'
          });
        }
      };

      for (const address of allowedAddresses) {
        const allowed = await readWithRetry(
          () => contract.externalContractAllowed(address) as Promise<boolean>
        );
        if (allowed === null) {
          steps.push({
            label: `allowlist ${address.slice(0, 8)}...`,
            contract: target.kind,
            move: 'READ_FAILED',
            detail: 'No se pudo leer externalContractAllowed (RPC).'
          });
          continue;
        }

        await runStep({
          label: `allowlist ${address.slice(0, 8)}...`,
          satisfied: allowed,
          actionId: externalContractActionId(address, true),
          callData: contract.interface.encodeFunctionData('setExternalContractAllowed', [
            getAddress(address),
            true
          ])
        });
      }

      if (target.kind !== 'vault') continue;

      const currentLimit = await readWithRetry(
        () => contract.dailyWithdrawalLimit() as Promise<bigint>
      );
      const totalAssets = await readWithRetry(() => contract.totalAssets() as Promise<bigint>);

      if (currentLimit === null || totalAssets === null) {
        steps.push({
          label: 'límite diario de retiro',
          contract: 'vault',
          move: 'READ_FAILED',
          detail: 'No se pudo leer dailyWithdrawalLimit/totalAssets (RPC).'
        });
        continue;
      }

      const freshTarget = resolveDailyWithdrawalLimit(totalAssets);
      if (freshTarget <= 0n) {
        // A limit of 0 would block every withdrawal; an empty vault has no
        // meaningful cap to set yet.
        steps.push({
          label: 'límite diario de retiro',
          contract: 'vault',
          move: 'NOT_APPLICABLE',
          detail: 'El vault no tiene activos, todavía no hay límite razonable que fijar.'
        });
        continue;
      }

      const candidates = Array.from(new Set([...previouslyScheduledLimits(asset), freshTarget]));
      let chosen = freshTarget;
      for (const candidate of candidates) {
        const readyAtRaw = await readWithRetry(
          () => contract.adminActionReadyAt(dailyWithdrawalLimitActionId(candidate)) as Promise<bigint>
        );
        if (readyAtRaw !== null && readyAtRaw > 0n) {
          chosen = candidate;
          break;
        }
      }

      const satisfied = currentLimit > 0n && currentLimit <= freshTarget;
      if (!satisfied && chosen === freshTarget) {
        await appendDeploymentEvent(asset.id, {
          step: 'SECURITY_REPAIR',
          status: 'PENDING',
          message: `Objetivo de límite diario fijado en ${freshTarget.toString()}.`,
          externalId: JSON.stringify({ dailyWithdrawalLimitTarget: freshTarget.toString() })
        });
      }

      await runStep({
        label: 'límite diario de retiro',
        satisfied,
        actionId: dailyWithdrawalLimitActionId(chosen),
        callData: contract.interface.encodeFunctionData('setDailyWithdrawalLimit', [chosen])
      });
    }

    const failed = steps.filter((step) => step.move === 'FAILED' || step.move === 'READ_FAILED');
    await appendDeploymentEvent(asset.id, {
      step: 'SECURITY_REPAIR',
      status: failed.length ? 'FAILED' : pending.length ? 'PENDING' : 'SUCCESS',
      message: failed.length
        ? `Reparación de seguridad con errores: ${failed.map((step) => step.label).join(', ')}`
        : pending.length
          ? `Reparación de seguridad en curso (timelock): ${pending.join(' · ')}`
          : 'Configuración de seguridad al día.'
    });

    return { ok: failed.length === 0, steps, pending };
  } finally {
    provider.destroy();
  }
}
