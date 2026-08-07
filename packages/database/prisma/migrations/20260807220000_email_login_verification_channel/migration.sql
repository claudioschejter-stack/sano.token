-- Second factor at login by email code.
--
-- A separate channel from EMAIL so a code issued to confirm a contact address
-- cannot be redeemed to open a session, and vice versa.
ALTER TYPE "VerificationChannel" ADD VALUE IF NOT EXISTS 'EMAIL_LOGIN';
