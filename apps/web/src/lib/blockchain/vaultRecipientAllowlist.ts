import { AbiCoder, Contract, JsonRpcProvider, getAddress, keccak256, toUtf8Bytes } from 'ethers';
import { resolveTreasuryOwnerSigner } from './treasuryOwnerSigner';
import { resolveChainId } from './explorerUrls';
import { execAsOwner } from './safeExec';
import { readWithRetry } from './rpcRetry';

/**
 * Let a smart-wallet investor receive vault shares.
 *
 * `SanovaRwaVault._update` rejects any recipient that has code unless it is in
 * `externalContractAllowed`. The intent was to keep shares out of public
 * liquidity pools, which is a requirement of the private structure. What it also
 * does, unintentionally, is reject the investors themselves: Privy delegates
 * embedded wallets through EIP-7702, so an ordinary personal wallet carries a
 * 23-byte delegation designator and reads as a contract.
 *
 * The result is a purchase that takes the money and reverts on delivery with
 * `SANOVA: contract receiver not allowed`, which no amount of KYC fixes. Like
 * `setKyc`, the allowance is timelocked, so what matters is starting the clock
 * during onboarding instead of discovering it at checkout.
 */

const VAULT_ABI = [
  'function externalContractAllowed(address) view returns (bool)',
  'function setExternalContractAllowed(address account, bool allowed)',
  'function setAdminActionDelay(uint256 delaySeconds)',
  'function scheduleAdminAction(bytes32 actionId)',
  'function adminActionReadyAt(bytes32) view returns (uint256)',
  'function adminActionDelay() view returns (uint256)',
  'function setupExpiresAt() view returns (uint256)',
  'function owner() view returns (address)'
];

/** The vault's own fixed action id for changing its delay. */
const SET_DELAY_ACTION_ID = keccak256(toUtf8Bytes('SET_ADMIN_ACTION_DELAY'));

/** The contract's own bounds: anything outside them reverts. */
const MIN_DELAY_SECONDS = 3600;
const MAX_DELAY_SECONDS = 7 * 24 * 3600;

/** Mirrors the vault's `keccak256(abi.encode("SET_EXTERNAL_CONTRACT_ALLOWED", account, allowed))`. */
export function externalContractActionId(account: string, allowed: boolean): string {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['string', 'address', 'bool'],
      ['SET_EXTERNAL_CONTRACT_ALLOWED', getAddress(account), allowed]
    )
  );
}

export type VaultRecipientState = {
  /** Whether the recipient carries code at all — an EOA needs no allowance. */
  isContract: boolean;
  allowed: boolean;
  actionId: string;
  readyAt: number | null;
  /** The allowance can be applied right now. */
  ready: boolean;
  inSetupWindow: boolean;
  delaySeconds: number | null;
};

export async function readVaultRecipientState(input: {
  provider: JsonRpcProvider;
  vaultAddress: string;
  recipient: string;
}): Promise<VaultRecipientState | null> {
  const recipient = getAddress(input.recipient);
  const vault = new Contract(getAddress(input.vaultAddress), VAULT_ABI, input.provider);
  const actionId = externalContractActionId(recipient, true);

  const [code, allowed, readyAtRaw, delayRaw, setupRaw] = await Promise.all([
    readWithRetry(() => input.provider.getCode(recipient)),
    readWithRetry(() => vault.externalContractAllowed(recipient) as Promise<boolean>),
    readWithRetry(() => vault.adminActionReadyAt(actionId) as Promise<bigint>),
    readWithRetry(() => vault.adminActionDelay() as Promise<bigint>),
    readWithRetry(() => vault.setupExpiresAt() as Promise<bigint>)
  ]);

  if (code === null || allowed === null) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const readyAt = readyAtRaw === null ? 0 : Number(readyAtRaw);
  const setupExpiresAt = setupRaw === null ? 0 : Number(setupRaw);
  const inSetupWindow = setupExpiresAt > now;

  return {
    isContract: code !== '0x' && code.length > 2,
    allowed: allowed === true,
    actionId,
    readyAt: readyAt > 0 ? readyAt : null,
    ready: inSetupWindow || (readyAt > 0 && now >= readyAt),
    inSetupWindow,
    delaySeconds: delayRaw === null ? null : Number(delayRaw)
  };
}

export type VaultRecipientResult =
  | { ok: true; status: 'ALREADY_ALLOWED' | 'NOT_A_CONTRACT' }
  | { ok: true; status: 'ALLOWED'; txHash: string }
  | { ok: true; status: 'SCHEDULED'; txHash: string; readyAt: number | null }
  | { ok: false; code: string; detail?: string; readyAt?: number | null };

/**
 * Make sure the recipient can receive shares of this vault, doing whichever
 * step the timelock allows: apply the allowance if the clock has run out, and
 * otherwise start it. Safe to call repeatedly.
 */
export async function ensureVaultRecipientAllowed(input: {
  provider: JsonRpcProvider;
  vaultAddress: string;
  recipient: string;
}): Promise<VaultRecipientResult> {
  const state = await readVaultRecipientState(input);
  if (!state) {
    return { ok: false, code: 'VAULT_READ_FAILED' };
  }
  if (state.allowed) {
    return { ok: true, status: 'ALREADY_ALLOWED' };
  }
  if (!state.isContract) {
    // A plain EOA passes the vault's receiver check on its own.
    return { ok: true, status: 'NOT_A_CONTRACT' };
  }

  const vault = new Contract(getAddress(input.vaultAddress), VAULT_ABI, input.provider);
  const owner = await readWithRetry(() => vault.owner() as Promise<string>);
  if (!owner) {
    return { ok: false, code: 'OWNER_READ_FAILED' };
  }

  const signer = await resolveTreasuryOwnerSigner(input.provider, resolveChainId());
  if (!signer) {
    return { ok: false, code: 'SAFE_OWNER_SIGNER_MISSING' };
  }

  if (state.ready) {
    const data = vault.interface.encodeFunctionData('setExternalContractAllowed', [
      getAddress(input.recipient),
      true
    ]);
    const txHash = await execAsOwner({
      owner: getAddress(owner),
      signer,
      target: getAddress(input.vaultAddress),
      data
    });
    return { ok: true, status: 'ALLOWED', txHash };
  }

  if (state.readyAt) {
    return {
      ok: false,
      code: 'SCHEDULED_NOT_READY',
      detail: `habilitable a partir de ${new Date(state.readyAt * 1000).toISOString()}`,
      readyAt: state.readyAt
    };
  }

  const data = vault.interface.encodeFunctionData('scheduleAdminAction', [state.actionId]);
  const txHash = await execAsOwner({
    owner: getAddress(owner),
    signer,
    target: getAddress(input.vaultAddress),
    data
  });

  const after = await readVaultRecipientState(input);
  return { ok: true, status: 'SCHEDULED', txHash, readyAt: after?.readyAt ?? null };
}

export type VaultDelayResult =
  | { ok: true; status: 'ALREADY_AT_TARGET'; delaySeconds: number }
  | { ok: true; status: 'APPLIED' | 'SCHEDULED'; txHash: string; delaySeconds: number; readyAt?: number | null }
  | { ok: false; code: string; detail?: string; readyAt?: number | null };

/**
 * Shorten the vault's admin delay, which is what every investor allowance waits
 * on.
 *
 * The delay is a compliance feature and the contract will not go below an hour,
 * so this trades a 24-hour wait per investor for a one-hour one — and since the
 * allowance is now scheduled during onboarding, an hour is time the investor
 * spends verifying identity anyway. Changing it is itself timelocked, so this
 * schedules on the first call and applies on a later one.
 */
export async function setVaultAdminDelay(input: {
  provider: JsonRpcProvider;
  vaultAddress: string;
  delaySeconds?: number;
}): Promise<VaultDelayResult> {
  const target = Math.trunc(input.delaySeconds ?? MIN_DELAY_SECONDS);
  if (target < MIN_DELAY_SECONDS || target > MAX_DELAY_SECONDS) {
    return {
      ok: false,
      code: 'DELAY_OUT_OF_RANGE',
      detail: `el contrato acepta entre ${MIN_DELAY_SECONDS} y ${MAX_DELAY_SECONDS} segundos`
    };
  }

  const vault = new Contract(getAddress(input.vaultAddress), VAULT_ABI, input.provider);
  const [currentRaw, readyAtRaw, setupRaw, owner] = await Promise.all([
    readWithRetry(() => vault.adminActionDelay() as Promise<bigint>),
    readWithRetry(() => vault.adminActionReadyAt(SET_DELAY_ACTION_ID) as Promise<bigint>),
    readWithRetry(() => vault.setupExpiresAt() as Promise<bigint>),
    readWithRetry(() => vault.owner() as Promise<string>)
  ]);

  if (currentRaw === null || !owner) {
    return { ok: false, code: 'VAULT_READ_FAILED' };
  }
  if (Number(currentRaw) === target) {
    return { ok: true, status: 'ALREADY_AT_TARGET', delaySeconds: target };
  }

  const signer = await resolveTreasuryOwnerSigner(input.provider, resolveChainId());
  if (!signer) {
    return { ok: false, code: 'SAFE_OWNER_SIGNER_MISSING' };
  }

  const now = Math.floor(Date.now() / 1000);
  const readyAt = readyAtRaw === null ? 0 : Number(readyAtRaw);
  const inSetupWindow = (setupRaw === null ? 0 : Number(setupRaw)) > now;

  if (inSetupWindow || (readyAt > 0 && now >= readyAt)) {
    const txHash = await execAsOwner({
      owner: getAddress(owner),
      signer,
      target: getAddress(input.vaultAddress),
      data: vault.interface.encodeFunctionData('setAdminActionDelay', [target])
    });
    return { ok: true, status: 'APPLIED', txHash, delaySeconds: target };
  }

  if (readyAt > 0) {
    return {
      ok: false,
      code: 'SCHEDULED_NOT_READY',
      detail: `aplicable a partir de ${new Date(readyAt * 1000).toISOString()}`,
      readyAt
    };
  }

  const txHash = await execAsOwner({
    owner: getAddress(owner),
    signer,
    target: getAddress(input.vaultAddress),
    data: vault.interface.encodeFunctionData('scheduleAdminAction', [SET_DELAY_ACTION_ID])
  });
  const after = await readWithRetry(
    () => vault.adminActionReadyAt(SET_DELAY_ACTION_ID) as Promise<bigint>
  );
  return {
    ok: true,
    status: 'SCHEDULED',
    txHash,
    delaySeconds: target,
    readyAt: after === null ? null : Number(after)
  };
}
