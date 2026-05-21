-- Run in Supabase SQL Editor if User table already exists without passwordHash
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
