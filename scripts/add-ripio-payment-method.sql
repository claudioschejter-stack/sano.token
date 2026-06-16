-- Add Ripio on-ramp payment method (run once on production DB if migrate deploy is not used).
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'RIPIO';
