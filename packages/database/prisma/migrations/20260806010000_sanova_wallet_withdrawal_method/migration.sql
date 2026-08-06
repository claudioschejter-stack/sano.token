-- A withdrawal from the investor's own Sanova wallet is a third kind of payout,
-- and it does not belong to either of the existing two.
--
-- STABLECOIN and FIAT both pay out of the internal ledger balance, so creating
-- one debits `PlatformWalletAccount`. This one moves USDC that is already
-- on-chain in the investor's wallet: there is no ledger balance to debit, and
-- debiting one would take money the investor never had there.

ALTER TYPE "PlatformWithdrawalMethod" ADD VALUE IF NOT EXISTS 'SANOVA_WALLET_USDC';
