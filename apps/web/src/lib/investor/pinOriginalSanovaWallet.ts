import { prisma } from '@sanova/database';
import { linkUserWallet } from './walletService';
import { getLinkedWalletForUser } from './linkedWalletPolicy';
import {
  listPrivyEthereumWalletAddressesForInvestor,
  resolveOriginalPrivyWalletForInvestor
} from '../privy/privyWalletProvisioning';
import { pickCanonicalReceiveAddress } from './sanovaReceiveWallet';
import { autoAllowlistInvestorWallet } from '../blockchain/autoAllowlistInvestorWallet';

export type PinOriginalWalletResult = {
  userId: string;
  email: string;
  status: 'PINNED' | 'ALREADY_PINNED' | 'FAILED' | 'NO_WALLET';
  originalAddress?: string;
  previousAddress?: string | null;
  duplicateAddresses?: string[];
};

/**
 * Force Sanova DB to the original Privy email wallet and report duplicates.
 * Does not delete wallets in Privy (requires Dashboard / owner auth) — it only
 * stops the app from using empty Custom Auth forks as the receive/settle target.
 */
export async function pinOriginalSanovaWalletForUser(userId: string): Promise<PinOriginalWalletResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true }
  });
  if (!user?.email) {
    return { userId, email: '', status: 'FAILED' };
  }

  const linked = await getLinkedWalletForUser(userId);
  const original = await resolveOriginalPrivyWalletForInvestor({
    userId,
    email: user.email
  });
  const all = await listPrivyEthereumWalletAddressesForInvestor({
    userId,
    email: user.email
  });

  // Ignore a wrongly-linked empty Custom Auth fork: prefer funded USDC, else
  // the original email registration wallet (never the later empty fork).
  const chosen =
    (await pickCanonicalReceiveAddress({
      candidates: all.length ? all : original?.address ? [original.address] : [],
      linkedAddress: null,
      originalAddress: original?.address ?? null
    })) ??
    original?.address ??
    null;

  if (!chosen) {
    return { userId, email: user.email, status: 'NO_WALLET', previousAddress: linked };
  }

  const duplicates = all.filter((address) => address !== chosen);
  if (linked === chosen) {
    return {
      userId,
      email: user.email,
      status: 'ALREADY_PINNED',
      originalAddress: chosen,
      previousAddress: linked,
      duplicateAddresses: duplicates
    };
  }

  await linkUserWallet(userId, chosen, 'Privy Wallet', { allowReplace: true });
  void autoAllowlistInvestorWallet(userId);

  return {
    userId,
    email: user.email,
    status: 'PINNED',
    originalAddress: chosen,
    previousAddress: linked,
    duplicateAddresses: duplicates
  };
}

/** Pin original wallets for all KYC-approved investors that have Privy duplicates. */
export async function pinOriginalSanovaWalletsForDuplicates(): Promise<{
  processed: number;
  pinned: number;
  results: PinOriginalWalletResult[];
}> {
  const users = await prisma.user.findMany({
    where: { systemRole: 'INVESTOR', kycStatus: 'APPROVED' },
    select: { id: true, email: true }
  });

  const results: PinOriginalWalletResult[] = [];
  for (const user of users) {
    const wallets = await listPrivyEthereumWalletAddressesForInvestor({
      userId: user.id,
      email: user.email
    });
    if (wallets.length <= 1) {
      continue;
    }
    results.push(await pinOriginalSanovaWalletForUser(user.id));
  }

  return {
    processed: results.length,
    pinned: results.filter((row) => row.status === 'PINNED').length,
    results
  };
}
