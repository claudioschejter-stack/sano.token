import { JsonRpcProvider, formatEther, getAddress, isAddress, parseEther, type Signer } from 'ethers';
import { resolveRwaOperatorSigner } from './rwaOperatorSigner';
import { resolveTreasuryOwnerSigner } from './treasuryOwnerSigner';
import { resolveMorphoLiquiditySigner } from './morphoLiquiditySigner';
import { resolveChainId } from './explorerUrls';
import { waitForAutomationTx } from './automationTx';

/**
 * Buying ETH and bridging it to Base is the slowest step in any of our
 * runbooks, and the platform usually already holds enough gas in one of its
 * own wallets. This moves it between them so a missing top-up never blocks an
 * operation.
 */

export type GasSourceRole = 'rwa_operator' | 'safe_owner' | 'morpho_liquidity';

/** Left in the source wallet so it can still sign its own transactions. */
const RESERVE_WEI = parseEther('0.002');
/** Ceiling per call: this endpoint moves value to an address the caller names. */
const MAX_TRANSFER_WEI = parseEther('0.01');

export type GasSourceStatus = {
  role: GasSourceRole;
  address: string | null;
  ethBalance: string | null;
  /** Most it could send right now while keeping its reserve. */
  availableEth: string | null;
};

async function resolveSource(
  role: GasSourceRole,
  provider: JsonRpcProvider,
  chainId: number
): Promise<{ signer: Signer; address: string; balance: bigint } | null> {
  try {
    const signer =
      role === 'rwa_operator'
        ? await resolveRwaOperatorSigner(provider, chainId)
        : role === 'safe_owner'
          ? await resolveTreasuryOwnerSigner(provider, chainId)
          : await resolveMorphoLiquiditySigner(provider, chainId);
    if (!signer) return null;
    const address = getAddress(await signer.getAddress());
    return { signer, address, balance: await provider.getBalance(address) };
  } catch {
    return null;
  }
}

const ROLES: GasSourceRole[] = ['rwa_operator', 'safe_owner', 'morpho_liquidity'];

export async function listGasSources(provider: JsonRpcProvider): Promise<GasSourceStatus[]> {
  const chainId = resolveChainId();
  const rows: GasSourceStatus[] = [];

  for (const role of ROLES) {
    const source = await resolveSource(role, provider, chainId);
    if (!source) {
      rows.push({ role, address: null, ethBalance: null, availableEth: null });
      continue;
    }
    const spare = source.balance > RESERVE_WEI ? source.balance - RESERVE_WEI : 0n;
    rows.push({
      role,
      address: source.address,
      ethBalance: formatEther(source.balance),
      availableEth: formatEther(spare > MAX_TRANSFER_WEI ? MAX_TRANSFER_WEI : spare)
    });
  }

  return rows;
}

export type FundGasResult =
  | {
      ok: true;
      from: string;
      fromRole: GasSourceRole;
      to: string;
      amountEth: string;
      txHash: string;
    }
  | { ok: false; code: string; detail?: string; sources?: GasSourceStatus[] };

export async function fundGasFromPlatformWallet(input: {
  provider: JsonRpcProvider;
  to: string;
  amountEth: number;
  /** Force a source instead of picking the wallet with the most spare ETH. */
  from?: GasSourceRole;
  /** Send even when the recipient already holds the requested amount. */
  force?: boolean;
}): Promise<FundGasResult> {
  if (!isAddress(input.to)) {
    return { ok: false, code: 'INVALID_RECIPIENT', detail: input.to };
  }
  if (!Number.isFinite(input.amountEth) || input.amountEth <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT', detail: String(input.amountEth) };
  }

  const value = parseEther(input.amountEth.toString());

  /**
   * Re-running a top-up is the normal way an operator confirms it worked, so
   * the default is to do nothing when the recipient is already funded rather
   * than quietly send a second time.
   */
  if (!input.force) {
    const current = await input.provider.getBalance(getAddress(input.to));
    if (current >= value) {
      return {
        ok: false,
        code: 'ALREADY_FUNDED',
        detail: `${input.to} ya tiene ${formatEther(current)} ETH; usá force:true para enviar igual`
      };
    }
  }

  if (value > MAX_TRANSFER_WEI) {
    return {
      ok: false,
      code: 'AMOUNT_ABOVE_CAP',
      detail: `máximo ${formatEther(MAX_TRANSFER_WEI)} ETH por llamada`
    };
  }

  const chainId = resolveChainId();
  const roles = input.from ? [input.from] : ROLES;

  const candidates: Array<{ role: GasSourceRole; signer: Signer; address: string; balance: bigint }> =
    [];
  for (const role of roles) {
    const source = await resolveSource(role, input.provider, chainId);
    if (source) {
      candidates.push({ role, ...source });
    }
  }

  // Prefer the wallet that can spare the most, so no signer is left near empty.
  const usable = candidates
    .filter((row) => row.balance >= value + RESERVE_WEI)
    .sort((a, b) => (b.balance > a.balance ? 1 : -1));

  const chosen = usable[0];
  if (!chosen) {
    return {
      ok: false,
      code: 'NO_SOURCE_WITH_ENOUGH_ETH',
      detail: `ninguna wallet puede enviar ${input.amountEth} ETH manteniendo su reserva de ${formatEther(RESERVE_WEI)} ETH`,
      sources: await listGasSources(input.provider)
    };
  }

  const to = getAddress(input.to);
  const tx = await chosen.signer.sendTransaction({ to, value });
  const receipt = await waitForAutomationTx(tx);

  return {
    ok: true,
    from: chosen.address,
    fromRole: chosen.role,
    to,
    amountEth: formatEther(value),
    txHash: receipt?.hash ?? tx.hash
  };
}
