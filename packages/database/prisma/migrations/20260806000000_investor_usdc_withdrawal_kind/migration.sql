-- An investor taking their own USDC out of their Sanova wallet had no kind in
-- the ledger, because the platform had no way to do it: every USDC movement the
-- code could produce went towards the treasury or came from it. Filing a
-- withdrawal as a treasury transfer would have made the bitácora lie about the
-- direction of the money.

ALTER TYPE "TokenMovementKind" ADD VALUE IF NOT EXISTS 'USDC_INVESTOR_WITHDRAWAL';
