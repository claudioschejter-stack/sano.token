import { getAddress, isAddress } from 'ethers';
import { prisma } from '@sanova/database';
import { resolveTreasuryAddress } from '../blockchain/treasuryPolicy';
import { resolveTreasuryOwnerAddress } from '../blockchain/treasuryOwnerSigner';
import { resolveMorphoLiquidityAddress } from '../blockchain/morphoLiquiditySigner';
import { resolveRwaOperatorAddressEnv } from '../privy/config';
import { kycOperatorModuleAddress } from '../blockchain/kycOperatorModule';
import { deliveryOperatorModuleAddress } from '../blockchain/deliveryOperatorModule';
import { getLendingChainConfig } from '../lending/baseContracts';

/**
 * Every address the platform controls or transacts against, with what it is.
 *
 * The USDC ledger has to filter by address — the token is far too busy to index
 * wholesale — and that filter used to know only the token treasury and wallets
 * saved on `User`. So rent paid from the stablecoin treasury, liquidity supplied
 * to Morpho, gas moved between operators and anything involving a Privy wallet
 * that was never written back to `User` all fell outside it and left no trace.
 *
 * Keeping the roster in one place is what makes the ledger complete by
 * construction: a new operational wallet is added here once and every movement
 * it makes becomes visible, instead of being discovered missing later.
 */

export type PlatformAddressRole =
  | 'token_treasury'
  | 'stablecoin_treasury'
  | 'safe_owner'
  | 'rwa_operator'
  | 'morpho_liquidity'
  | 'privy_treasury'
  | 'kyc_module'
  | 'delivery_module'
  | 'morpho'
  | 'investor';

export type PlatformAddress = {
  address: string;
  role: PlatformAddressRole;
  userId?: string | null;
  investorId?: string | null;
};

function push(
  into: Map<string, PlatformAddress>,
  role: PlatformAddressRole,
  raw: string | null | undefined
) {
  const value = raw?.trim();
  if (!value || !isAddress(value)) return;
  const key = value.toLowerCase();
  // First writer wins: platform roles are more specific than `investor`.
  if (!into.has(key)) {
    into.set(key, { address: getAddress(value), role });
  }
}

/** Operational addresses, from configuration only. */
export function platformOperationalAddresses(): Map<string, PlatformAddress> {
  const map = new Map<string, PlatformAddress>();

  push(map, 'token_treasury', resolveTreasuryAddress());
  push(map, 'stablecoin_treasury', process.env.BASE_STABLECOIN_TREASURY_ADDRESS);
  push(map, 'stablecoin_treasury', process.env.STABLECOIN_TREASURY_ADDRESS);
  push(map, 'safe_owner', resolveTreasuryOwnerAddress());
  push(map, 'rwa_operator', resolveRwaOperatorAddressEnv());
  push(map, 'morpho_liquidity', resolveMorphoLiquidityAddress());
  push(map, 'privy_treasury', process.env.PRIVY_TREASURY_ADDRESS);
  push(map, 'kyc_module', kycOperatorModuleAddress());
  push(map, 'delivery_module', deliveryOperatorModuleAddress());

  try {
    push(map, 'morpho', getLendingChainConfig().morpho);
  } catch {
    // Chain config unavailable: the rest of the roster still stands.
  }

  return map;
}

/**
 * Operational addresses plus every wallet linked to a user or investor.
 *
 * Investor wallets come from `User.walletAddress` and from `Investor`, because a
 * Privy wallet is not always written back to both.
 */
export async function platformAddressRegistry(): Promise<Map<string, PlatformAddress>> {
  const map = platformOperationalAddresses();

  const [users, investors] = await Promise.all([
    prisma.user.findMany({
      where: { walletAddress: { not: null } },
      select: { id: true, walletAddress: true, investorId: true }
    }),
    // `Investor` has no user column; the link lives on `User.investorId`.
    prisma.investor
      .findMany({ select: { id: true, walletAddress: true } })
      .catch(() => [] as Array<{ id: string; walletAddress: string | null }>)
  ]);

  for (const user of users) {
    const value = user.walletAddress?.trim();
    if (!value || !isAddress(value)) continue;
    const key = value.toLowerCase();
    if (map.has(key)) continue;
    map.set(key, {
      address: getAddress(value),
      role: 'investor',
      userId: user.id,
      investorId: user.investorId
    });
  }

  const userIdByInvestorId = new Map<string, string>();
  for (const user of users) {
    if (user.investorId) {
      userIdByInvestorId.set(user.investorId, user.id);
    }
  }

  for (const investor of investors) {
    const value = investor.walletAddress?.trim();
    if (!value || !isAddress(value)) continue;
    const key = value.toLowerCase();
    if (map.has(key)) continue;
    map.set(key, {
      address: getAddress(value),
      role: 'investor',
      userId: userIdByInvestorId.get(investor.id) ?? null,
      investorId: investor.id
    });
  }

  return map;
}
