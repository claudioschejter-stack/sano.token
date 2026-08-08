-- The `TRANSAK` payment method never carried a Transak integration: the value was
-- reused as the filing name for the Privy card on-ramp. Renaming the value keeps
-- every existing row valid while removing the misleading provider name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentMethod' AND e.enumlabel = 'TRANSAK'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentMethod' AND e.enumlabel = 'PRIVY_ONRAMP'
  ) THEN
    ALTER TYPE "PaymentMethod" RENAME VALUE 'TRANSAK' TO 'PRIVY_ONRAMP';
  END IF;
END
$$;
