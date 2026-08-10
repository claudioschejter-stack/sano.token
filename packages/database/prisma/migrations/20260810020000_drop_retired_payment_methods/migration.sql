-- Sacar del enum los métodos de pago que no tienen cobrador detrás.
--
-- STRIPE estaba deshabilitado en código, RAMP respondía RAMP_NOT_INTEGRATED,
-- COINBASE era Coinbase Commerce y CUSTODIAL_STABLECOIN tenía plumbing sin flujo
-- de checkout. Un valor de enum que ningún camino puede producir es una opción
-- que parece existir cuando se lee el esquema.
--
-- Postgres no permite borrar valores de un enum, así que hay que recrear el tipo.
-- Verificado antes de escribir esto: ninguna fila de PaymentIntent ni de
-- PlatformDeposit usa los cuatro valores, y son las únicas dos columnas que usan
-- el tipo.
--
-- El bloque es idempotente: si el tipo ya está sin esos valores no hace nada, así
-- que correrlo de nuevo es inofensivo.
DO $$
DECLARE
  sobrantes int;
BEGIN
  SELECT COUNT(*) INTO sobrantes
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'PaymentMethod'
    AND e.enumlabel IN ('STRIPE', 'RAMP', 'COINBASE', 'CUSTODIAL_STABLECOIN');

  IF sobrantes = 0 THEN
    RETURN;
  END IF;

  -- Si quedara alguna fila con un valor retirado, abortar en vez de perderla.
  IF EXISTS (
    SELECT 1 FROM "PaymentIntent"
    WHERE "method"::text IN ('STRIPE', 'RAMP', 'COINBASE', 'CUSTODIAL_STABLECOIN')
  ) OR EXISTS (
    SELECT 1 FROM "PlatformDeposit"
    WHERE "method"::text IN ('STRIPE', 'RAMP', 'COINBASE', 'CUSTODIAL_STABLECOIN')
  ) THEN
    RAISE EXCEPTION 'Hay filas usando un método retirado; migralas antes de recrear el enum.';
  END IF;

  CREATE TYPE "PaymentMethod_new" AS ENUM (
    'INTERNAL_BALANCE',
    'USDC_ONCHAIN',
    'LOCAL_RAIL',
    'BRIDGE',
    'PRIVY_ONRAMP',
    'RIPIO',
    'MERCADO_PAGO'
  );

  ALTER TABLE "PaymentIntent"
    ALTER COLUMN "method" TYPE "PaymentMethod_new"
    USING ("method"::text::"PaymentMethod_new");

  ALTER TABLE "PlatformDeposit"
    ALTER COLUMN "method" TYPE "PaymentMethod_new"
    USING ("method"::text::"PaymentMethod_new");

  DROP TYPE "PaymentMethod";
  ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
END
$$;
