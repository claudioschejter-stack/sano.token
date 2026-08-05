import { AbiCoder, Contract, JsonRpcProvider, getAddress, keccak256 } from 'ethers';
import { resolveTreasuryOwnerSigner } from './treasuryOwnerSigner';
import { resolveChainId } from './explorerUrls';
import { execAsOwner } from './safeExec';
import { readWithRetry } from './rpcRetry';

/**
 * Start the token's KYC timelock.
 *
 * `SanovaAssetToken.setKyc` is timelocked: past the deployment setup window the
 * action has to be scheduled and then wait out `adminActionDelay` before it can
 * run. Approving an investor is therefore two transactions separated by time,
 * and the KYC module only exposes the second one — so allowlisting reverted with
 * `SANOVA: KYC timelock pending` and no amount of retrying would have helped.
 *
 * The delay is a compliance feature worth keeping. What matters is when the
 * clock starts: scheduling at KYC approval instead of at checkout means the wait
 * overlaps with onboarding rather than blocking a purchase.
 */

const TOKEN_ABI = [
  'function scheduleAdminAction(bytes32 actionId)',
  'function adminActionReadyAt(bytes32) view returns (uint256)',
  'function adminActionDelay() view returns (uint256)',
  'function setupExpiresAt() view returns (uint256)',
  'function kycApproved(address) view returns (bool)',
  'function owner() view returns (address)'
];

/** Returns the tx hash when the module could schedule, or null to fall back. */
async function scheduleThroughModule(input: {
  provider: JsonRpcProvider;
  tokenAddress: string;
  investorAddress: string;
  approved: boolean;
}): Promise<string | null> {
  try {
    const {
      kycOperatorModuleAddress,
      moduleCanSchedule,
      moduleCanWhitelist,
      scheduleKycViaModule
    } = await import('./kycOperatorModule');

    const moduleAddress = kycOperatorModuleAddress();
    if (!moduleAddress) return null;

    const { isRwaOperatorConfigured, resolveRwaOperatorSigner } = await import('./rwaOperatorSigner');
    if (!isRwaOperatorConfigured()) return null;

    const signer = await resolveRwaOperatorSigner(input.provider, resolveChainId());
    if (!signer) return null;

    const operatorAddress = await signer.getAddress();
    const [scopedForToken, canSchedule] = await Promise.all([
      moduleCanWhitelist({
        moduleAddress,
        tokenAddress: input.tokenAddress,
        operatorAddress,
        provider: input.provider
      }),
      moduleCanSchedule({ moduleAddress, provider: input.provider })
    ]);
    if (!scopedForToken || !canSchedule) return null;

    return await scheduleKycViaModule({
      moduleAddress,
      tokenAddress: input.tokenAddress,
      investorAddress: input.investorAddress,
      approved: input.approved,
      signer
    });
  } catch {
    return null;
  }
}

/** Mirrors `keccak256(abi.encode("SET_KYC", account, approved))` in the token. */
export function kycActionId(investor: string, approved: boolean): string {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['string', 'address', 'bool'],
      ['SET_KYC', getAddress(investor), approved]
    )
  );
}

export type KycTimelockState = {
  actionId: string;
  /** Unix seconds when the action may run, or null when not scheduled. */
  readyAt: number | null;
  ready: boolean;
  /** True while the post-deployment window still bypasses the timelock. */
  inSetupWindow: boolean;
  delaySeconds: number | null;
  alreadyApproved: boolean;
};

export async function readKycTimelock(input: {
  provider: JsonRpcProvider;
  tokenAddress: string;
  investorAddress: string;
  approved?: boolean;
}): Promise<KycTimelockState | null> {
  const approved = input.approved ?? true;
  const actionId = kycActionId(input.investorAddress, approved);
  const token = new Contract(input.tokenAddress, TOKEN_ABI, input.provider);

  const [readyAtRaw, delayRaw, setupRaw, approvedNow] = await Promise.all([
    readWithRetry(() => token.adminActionReadyAt(actionId) as Promise<bigint>),
    readWithRetry(() => token.adminActionDelay() as Promise<bigint>),
    readWithRetry(() => token.setupExpiresAt() as Promise<bigint>),
    readWithRetry(() => token.kycApproved(getAddress(input.investorAddress)) as Promise<boolean>)
  ]);

  if (readyAtRaw === null) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const readyAt = Number(readyAtRaw);
  const setupExpiresAt = setupRaw === null ? 0 : Number(setupRaw);
  const inSetupWindow = setupExpiresAt > now;

  return {
    actionId,
    readyAt: readyAt > 0 ? readyAt : null,
    ready: inSetupWindow || (readyAt > 0 && now >= readyAt),
    inSetupWindow,
    delaySeconds: delayRaw === null ? null : Number(delayRaw),
    alreadyApproved: approvedNow === true
  };
}

export type ScheduleKycResult =
  | { ok: true; actionId: string; readyAt: number | null; txHash: string }
  | { ok: false; code: string; detail?: string; readyAt?: number | null };

/**
 * Schedule the KYC action through whoever owns the token.
 *
 * The module cannot do this — it only carries `setKyc` — so it goes through the
 * owner, which is the governance Safe.
 */
export async function scheduleTokenKyc(input: {
  provider: JsonRpcProvider;
  tokenAddress: string;
  investorAddress: string;
  approved?: boolean;
}): Promise<ScheduleKycResult> {
  const approved = input.approved ?? true;
  const state = await readKycTimelock(input);

  if (!state) {
    return { ok: false, code: 'TOKEN_READ_FAILED' };
  }
  if (state.alreadyApproved && approved) {
    return { ok: false, code: 'ALREADY_APPROVED' };
  }
  if (state.ready) {
    return {
      ok: false,
      code: 'ALREADY_SCHEDULED',
      detail: state.inSetupWindow
        ? 'el token está en su ventana de setup: setKyc puede ejecutarse ya'
        : 'la acción ya está agendada y disponible',
      readyAt: state.readyAt
    };
  }
  if (state.readyAt) {
    return {
      ok: false,
      code: 'SCHEDULED_NOT_READY',
      detail: `disponible a partir de ${new Date(state.readyAt * 1000).toISOString()}`,
      readyAt: state.readyAt
    };
  }

  const token = new Contract(input.tokenAddress, TOKEN_ABI, input.provider);

  /**
   * Prefer the module: it lets the operator schedule alone, so this keeps
   * working when the Safe moves to two signatures. Falls back to the Safe for
   * modules deployed before scheduling existed.
   */
  const viaModule = await scheduleThroughModule({
    provider: input.provider,
    tokenAddress: input.tokenAddress,
    investorAddress: input.investorAddress,
    approved
  });
  if (viaModule) {
    const after = await readKycTimelock(input);
    return {
      ok: true,
      actionId: kycActionId(input.investorAddress, approved),
      readyAt: after?.readyAt ?? null,
      txHash: viaModule
    };
  }

  const owner = await readWithRetry(() => token.owner() as Promise<string>);
  if (!owner) {
    return { ok: false, code: 'OWNER_READ_FAILED' };
  }

  const signer = await resolveTreasuryOwnerSigner(input.provider, resolveChainId());
  if (!signer) {
    return { ok: false, code: 'SAFE_OWNER_SIGNER_MISSING' };
  }

  const data = token.interface.encodeFunctionData('scheduleAdminAction', [
    kycActionId(input.investorAddress, approved)
  ]);
  const txHash = await execAsOwner({
    owner: getAddress(owner),
    signer,
    target: getAddress(input.tokenAddress),
    data
  });

  const after = await readKycTimelock(input);
  return {
    ok: true,
    actionId: kycActionId(input.investorAddress, approved),
    readyAt: after?.readyAt ?? null,
    txHash
  };
}
