import { ZeroAddress } from 'ethers';
import type { PlatformAddress, PlatformAddressRole } from './platformAddressRegistry';
import type { TokenMovementKindName } from './tokenMovementLedger';

/**
 * Name a transfer by what it was, not just that it happened.
 *
 * Every USDC movement used to be filed as `USDC_PAYMENT`, so the ledger could
 * tell you money moved but not whether it was a purchase, rent, a gas top-up or
 * liquidity going to Morpho. A log you have to interpret transfer by transfer is
 * not a ledger.
 */
export function classifyMovement(input: {
  asset: 'USDC' | 'RWA_SHARE';
  fromRole: PlatformAddressRole | null;
  toRole: PlatformAddressRole | null;
}): TokenMovementKindName {
  const { fromRole, toRole } = input;

  if (input.asset === 'RWA_SHARE') {
    if (fromRole === 'delivery_module' || toRole === 'investor') {
      return 'RWA_SHARE_DELIVERY';
    }
    return 'RWA_SHARE_TRANSFER';
  }

  const treasuryRoles: PlatformAddressRole[] = [
    'token_treasury',
    'stablecoin_treasury',
    'privy_treasury'
  ];
  const fromTreasury = fromRole ? treasuryRoles.includes(fromRole) : false;
  const toTreasury = toRole ? treasuryRoles.includes(toRole) : false;

  // Investor to treasury is a purchase; treasury to investor is a distribution.
  if (fromRole === 'investor' && toTreasury) {
    return 'USDC_PAYMENT';
  }
  if (fromTreasury && toRole === 'investor') {
    return 'USDC_RENT_PAYOUT';
  }
  if (fromRole === 'morpho_liquidity' && toRole === 'morpho') {
    return 'MORPHO_SUPPLY';
  }
  if (fromRole === 'morpho' && toRole === 'morpho_liquidity') {
    return 'MORPHO_WITHDRAW';
  }
  if (fromRole === 'morpho' && toRole === 'investor') {
    return 'MORPHO_BORROW';
  }
  if (fromRole === 'investor' && toRole === 'morpho') {
    return 'MORPHO_REPAY';
  }
  if (fromTreasury || toTreasury) {
    return 'USDC_TREASURY_TRANSFER';
  }

  return 'USDC_PAYMENT';
}

/** Share mints and burns are recognised by the zero address, not by role. */
export function classifyShareMovement(input: {
  fromAddress: string;
  toAddress: string;
  fromRole: PlatformAddressRole | null;
  toRole: PlatformAddressRole | null;
}): TokenMovementKindName {
  const zero = ZeroAddress.toLowerCase();
  if (input.fromAddress.toLowerCase() === zero) return 'RWA_SHARE_MINT';
  if (input.toAddress.toLowerCase() === zero) return 'RWA_SHARE_BURN';
  return classifyMovement({
    asset: 'RWA_SHARE',
    fromRole: input.fromRole,
    toRole: input.toRole
  });
}

/** Attribution for the ledger row: whichever side is a known investor. */
export function attributeMovement(
  from: PlatformAddress | undefined,
  to: PlatformAddress | undefined
): { userId: string | null; investorId: string | null } {
  const investor =
    to?.role === 'investor' ? to : from?.role === 'investor' ? from : (to ?? from);
  return {
    userId: investor?.userId ?? null,
    investorId: investor?.investorId ?? null
  };
}
