import { prisma } from '@sanova/database';
import { Contract, JsonRpcProvider, formatEther, formatUnits } from 'ethers';
import { getLinkedWalletForUser } from '../investor/linkedWalletPolicy';
import { getStablecoinNetwork, baseRpcUrls } from '../payments/stablecoinNetworks';
import { privyAppId } from './config';
import {
  isPrivyAuthorizationSigningConfigured,
  privyAuthorizationKeyQuorumId
} from './privyAuthorizationSignature';
import { privyApiBase, privyHeaders } from './privyHttp';
import {
  listPrivyEthereumWalletAddressesForInvestor,
  lookupPrivyUserByCustomAuthId,
  lookupPrivyUserByEmail
} from './privyWalletProvisioning';
import { resolveInvestorPrivyWalletIdForUser } from './resolveInvestorPrivyWalletId';

export type PrivyPayDiagnostics = {
  userId: string;
  email: string | null;
  dbLinkedAddress: string | null;
  resolvedWalletId: string | null;
  privyUsers: Array<{ source: 'email' | 'custom_auth'; privyUserId: string; wallets: string[] }>;
  duplicateWallets: string[];
  wallet: {
    id: string;
    address: string;
    ownerId: string | null;
    additionalSignerIds: string[];
  } | null;
  authorization: {
    privateKeyConfigured: boolean;
    quorumIdEnv: string | null;
    quorumIsAdditionalSigner: boolean | null;
    quorumIsOwner: boolean | null;
  };
  appConfig: {
    mode: string | null;
    ethereumCreateOnLogin: string | null;
    enforceWalletUis: boolean | null;
    maxLinkedWalletsPerUser: number | null;
  } | null;
  balances: { usdcBase: number | null; ethBase: number | null };
  treasuryAddress: string | null;
  /** Actionable problems, ordered by severity. */
  blockers: string[];
  warnings: string[];
};

async function fetchPrivyWallet(walletId: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${privyApiBase()}/v1/wallets/${walletId}`, {
      headers: privyHeaders(),
      cache: 'no-store'
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchPrivyAppConfig(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${privyApiBase()}/v1/apps/${privyAppId()}`, {
      headers: privyHeaders(),
      cache: 'no-store'
    });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function readBalances(address: string): Promise<{ usdcBase: number | null; ethBase: number | null }> {
  const network = getStablecoinNetwork('BASE');
  for (const url of baseRpcUrls()) {
    const provider = new JsonRpcProvider(url, 8453, { staticNetwork: true });
    try {
      const eth = await provider.getBalance(address);
      let usdc: number | null = null;
      if (network.tokenAddress) {
        const token = new Contract(
          network.tokenAddress,
          ['function balanceOf(address) view returns (uint256)'],
          provider
        );
        const raw = (await token.balanceOf(address)) as bigint;
        usdc = Number(formatUnits(raw, network.decimals ?? 6));
      }
      provider.destroy();
      return { usdcBase: usdc, ethBase: Number(formatEther(eth)) };
    } catch {
      provider.destroy();
    }
  }
  return { usdcBase: null, ethBase: null };
}

/**
 * One-shot answer to “why can’t the server pay from this Sanova wallet?”.
 * Reports identity, signer, gas and Dashboard settings instead of guessing.
 */
export async function collectPrivyPayDiagnostics(userId: string): Promise<PrivyPayDiagnostics> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  const email = user?.email ?? null;

  const dbLinkedAddress = await getLinkedWalletForUser(userId);
  const walletRef = await resolveInvestorPrivyWalletIdForUser(userId);

  const privyUsers: PrivyPayDiagnostics['privyUsers'] = [];
  if (email) {
    const emailUser = await lookupPrivyUserByEmail(email).catch(() => null);
    if (emailUser) {
      privyUsers.push({
        source: 'email',
        privyUserId: emailUser.id,
        wallets: (emailUser.linked_accounts ?? [])
          .filter((a) => a.type === 'wallet' && a.address)
          .map((a) => a.address!.toLowerCase())
      });
    }
  }
  const customUser = await lookupPrivyUserByCustomAuthId(userId).catch(() => null);
  if (customUser) {
    privyUsers.push({
      source: 'custom_auth',
      privyUserId: customUser.id,
      wallets: (customUser.linked_accounts ?? [])
        .filter((a) => a.type === 'wallet' && a.address)
        .map((a) => a.address!.toLowerCase())
    });
  }

  const allWallets = await listPrivyEthereumWalletAddressesForInvestor({ userId, email });
  const duplicateWallets = allWallets.filter((address) => address !== dbLinkedAddress);

  const walletRecord = walletRef?.walletId ? await fetchPrivyWallet(walletRef.walletId) : null;
  const additionalSigners = Array.isArray(walletRecord?.additional_signers)
    ? (walletRecord!.additional_signers as Array<{ signer_id?: string }>)
    : [];
  const additionalSignerIds = additionalSigners
    .map((row) => row.signer_id?.trim())
    .filter((id): id is string => Boolean(id));
  const ownerId =
    typeof walletRecord?.owner_id === 'string' ? (walletRecord.owner_id as string) : null;

  const quorumIdEnv = privyAuthorizationKeyQuorumId() || null;
  const appRecord = await fetchPrivyAppConfig();
  const embedded = (appRecord?.embedded_wallet_config ?? null) as Record<string, unknown> | null;
  const ethereum = (embedded?.ethereum ?? null) as Record<string, unknown> | null;

  const balances = dbLinkedAddress
    ? await readBalances(dbLinkedAddress)
    : { usdcBase: null, ethBase: null };

  const treasuryAddress = getStablecoinNetwork('BASE').treasuryAddress;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!isPrivyAuthorizationSigningConfigured()) {
    blockers.push('PRIVY_AUTHORIZATION_PRIVATE_KEY missing in Vercel.');
  }
  if (!quorumIdEnv) {
    blockers.push('PRIVY_AUTHORIZATION_KEY_QUORUM_ID missing in Vercel.');
  }
  if (!walletRef) {
    blockers.push('Privy wallet id could not be resolved for the linked address.');
  }
  if (!treasuryAddress) {
    blockers.push('BASE_STABLECOIN_TREASURY_ADDRESS not configured.');
  }
  if (quorumIdEnv && walletRecord && !additionalSignerIds.includes(quorumIdEnv) && ownerId !== quorumIdEnv) {
    blockers.push(
      `Authorization quorum ${quorumIdEnv} is neither owner nor additional signer on wallet ${walletRef?.walletId}.`
    );
  }
  if (ethereum && ethereum.create_on_login && ethereum.create_on_login !== 'off') {
    blockers.push(
      `Dashboard embedded wallets → ethereum.create_on_login = "${String(
        ethereum.create_on_login
      )}". Set it to "off" or Privy keeps minting duplicate wallets on Custom Auth login.`
    );
  }
  if (duplicateWallets.length > 0) {
    warnings.push(`Duplicate Privy wallets for this investor: ${duplicateWallets.join(', ')}`);
  }
  if (balances.ethBase != null && balances.ethBase === 0) {
    warnings.push(
      'Wallet holds 0 ETH — the transfer only works while Dashboard gas is "User pays" with Base/USDC configured.'
    );
  }

  return {
    userId,
    email,
    dbLinkedAddress,
    resolvedWalletId: walletRef?.walletId ?? null,
    privyUsers,
    duplicateWallets,
    wallet: walletRecord
      ? {
          id: String(walletRecord.id ?? walletRef?.walletId ?? ''),
          address: String(walletRecord.address ?? dbLinkedAddress ?? ''),
          ownerId,
          additionalSignerIds
        }
      : null,
    authorization: {
      privateKeyConfigured: isPrivyAuthorizationSigningConfigured(),
      quorumIdEnv,
      quorumIsAdditionalSigner: quorumIdEnv ? additionalSignerIds.includes(quorumIdEnv) : null,
      quorumIsOwner: quorumIdEnv ? ownerId === quorumIdEnv : null
    },
    appConfig: appRecord
      ? {
          mode: typeof embedded?.mode === 'string' ? (embedded.mode as string) : null,
          ethereumCreateOnLogin:
            typeof ethereum?.create_on_login === 'string' ? (ethereum.create_on_login as string) : null,
          enforceWalletUis:
            typeof appRecord.enforce_wallet_uis === 'boolean'
              ? (appRecord.enforce_wallet_uis as boolean)
              : null,
          maxLinkedWalletsPerUser:
            typeof appRecord.max_linked_wallets_per_user === 'number'
              ? (appRecord.max_linked_wallets_per_user as number)
              : null
        }
      : null,
    balances,
    treasuryAddress,
    blockers,
    warnings
  };
}
