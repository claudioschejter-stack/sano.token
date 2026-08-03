import { prisma } from '@sanova/database';
import { getAddress, isAddress } from 'ethers';
import { isPendingInvestorWallet } from './provisionInvestorProfile';
import { linkUserWallet } from './walletService';
import { getLinkedWalletForUser } from './linkedWalletPolicy';
import { readWalletUsdcBalances } from '../portfolio/onChainUsdcReader';
import {
  ensureSanovaPrivyWallet,
  listPrivyEthereumWalletAddressesForInvestor,
  resolveOriginalPrivyWalletForInvestor
} from '../privy/privyWalletProvisioning';
import { autoAllowlistInvestorWallet } from '../blockchain/autoAllowlistInvestorWallet';

export type SanovaReceiveWallet = {
  walletAddress: string;
  walletProvider: string;
  source: 'linked' | 'privy_reconcile' | 'privy_provision';
  reconciled: boolean;
};

function normalizeAddress(value: string): string {
  if (!isAddress(value)) {
    throw new Error('INVALID_WALLET');
  }
  return getAddress(value).toLowerCase();
}

async function usdcBalanceBase(address: string): Promise<number> {
  try {
    const rows = await readWalletUsdcBalances(address, ['BASE']);
    return rows.reduce((sum, row) => sum + row.amountUsdc, 0);
  } catch {
    return 0;
  }
}

/**
 * Picks one receive address when multiple eth wallets exist.
 * Prefer: funded USDC on Base → currently linked → original/first candidate
 * (callers pass email-registration wallets first).
 */
export async function pickCanonicalReceiveAddress(input: {
  candidates: string[];
  linkedAddress?: string | null;
  /** Explicit original registration wallet — wins over empty forks when unfunded. */
  originalAddress?: string | null;
}): Promise<string | null> {
  const unique = [
    ...new Set(
      input.candidates
        .map((row) => row.trim().toLowerCase())
        .filter((row) => row && isAddress(row) && !isPendingInvestorWallet(row))
    )
  ];
  if (unique.length === 0) {
    return null;
  }
  if (unique.length === 1) {
    return unique[0] ?? null;
  }

  const balances = await Promise.all(
    unique.map(async (address) => ({ address, balance: await usdcBalanceBase(address) }))
  );
  const funded = balances
    .filter((row) => row.balance > 1e-9)
    .sort((a, b) => b.balance - a.balance);
  if (funded.length === 1) {
    return funded[0]?.address ?? null;
  }
  if (funded.length > 1) {
    const linkedFunded = input.linkedAddress?.trim().toLowerCase();
    if (linkedFunded && funded.some((row) => row.address === linkedFunded)) {
      return linkedFunded;
    }
    return funded[0]?.address ?? null;
  }

  const linked = input.linkedAddress?.trim().toLowerCase();
  if (linked && unique.includes(linked)) {
    return linked;
  }

  const original = input.originalAddress?.trim().toLowerCase();
  if (original && unique.includes(original)) {
    return original;
  }

  // candidates are email-first from listPrivyEthereumWalletAddressesForInvestor
  return unique[0] ?? null;
}

/**
 * Canonical Sanova USDC receive address for an investor.
 *
 * Source of truth is the server-linked wallet, reconciled against Privy wallets
 * for Custom Auth (user.id) + email. Never trusts a browser Privy SDK address
 * alone — that caused checkout to show a different address than the one we watch.
 */
export async function ensureSanovaReceiveWalletForUser(userId: string): Promise<SanovaReceiveWallet | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      kycStatus: true,
      emailVerifiedAt: true,
      walletAddress: true,
      walletProvider: true,
      investor: { select: { walletAddress: true } }
    }
  });

  if (!user || user.kycStatus !== 'APPROVED' || !user.emailVerifiedAt) {
    return null;
  }

  const linked = await getLinkedWalletForUser(userId);
  const privyWallets = await listPrivyEthereumWalletAddressesForInvestor({
    userId,
    email: user.email
  });
  const original = await resolveOriginalPrivyWalletForInvestor({
    userId,
    email: user.email
  });

  let source: SanovaReceiveWallet['source'] = 'linked';
  let reconciled = false;
  let chosen: string | null = null;

  if (privyWallets.length > 0) {
    chosen = await pickCanonicalReceiveAddress({
      candidates: privyWallets,
      linkedAddress: linked,
      originalAddress: original?.address ?? privyWallets[0] ?? null
    });
    if (chosen && linked && chosen === linked) {
      source = 'linked';
    } else if (chosen) {
      source = linked ? 'privy_reconcile' : 'privy_provision';
    }
  }

  if (!chosen) {
    chosen = linked;
    source = 'linked';
  }

  if (!chosen) {
    const provisioned = await ensureSanovaPrivyWallet({ userId, email: user.email });
    if (!provisioned?.address) {
      return null;
    }
    chosen = normalizeAddress(provisioned.address);
    source = 'privy_provision';
  } else {
    // Idempotent + non-forking: will reuse original email wallet, never mint a second.
    await ensureSanovaPrivyWallet({ userId, email: user.email }).catch(() => null);
    chosen = normalizeAddress(chosen);
  }

  if (!linked || linked !== chosen) {
    if (linked && linked !== chosen) {
      console.warn('[sanovaReceiveWallet] reconciling receive address drift', {
        userId,
        from: linked,
        to: chosen,
        source: linked ? 'privy_reconcile' : 'privy_provision'
      });
    }
    await linkUserWallet(userId, chosen, 'Privy Wallet', { allowReplace: true });
    reconciled = Boolean(linked && linked !== chosen);
    void autoAllowlistInvestorWallet(userId);
  } else {
    void autoAllowlistInvestorWallet(userId);
  }

  return {
    walletAddress: chosen,
    walletProvider: user.walletProvider?.trim() || 'Privy Wallet',
    source,
    reconciled
  };
}
