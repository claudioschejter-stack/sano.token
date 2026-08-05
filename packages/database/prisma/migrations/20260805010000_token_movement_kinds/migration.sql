-- The ledger covered the USDC purchase flow and vault share transfers. Morpho
-- lending, rent and yield payouts and share deliveries had nowhere to be
-- recorded, so they were absent rather than misfiled.

ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'USDC_RENT_PAYOUT';
ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'USDC_YIELD_PAYOUT';
ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'USDC_TREASURY_TRANSFER';
ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'RWA_SHARE_DELIVERY';
ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'MORPHO_SUPPLY';
ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'MORPHO_WITHDRAW';
ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'MORPHO_BORROW';
ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'MORPHO_REPAY';
ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'MORPHO_COLLATERAL_IN';
ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'MORPHO_COLLATERAL_OUT';
ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'MORPHO_LIQUIDATION';
