import { prisma } from '@sanova/database';

/** Wallet del emisor/admin que recibe shares del vault y usa colateral Morpho. */
export async function resolveLaunchIssuerWallet(adminUserId?: string | null): Promise<string | null> {
  const envWallet = process.env.LAUNCH_ISSUER_WALLET?.trim();
  if (!adminUserId) {
    return envWallet || null;
  }

  const user = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { walletAddress: true }
  });

  return user?.walletAddress?.trim() || envWallet || null;
}
