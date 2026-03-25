-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MembershipStatus') THEN
    CREATE TYPE "MembershipStatus" AS ENUM ('active', 'left');
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "family_members"
  ADD COLUMN IF NOT EXISTS "status" "MembershipStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "left_at" TIMESTAMP(3);

-- Backfill defensive
UPDATE "family_members"
SET "status" = 'active'
WHERE "status" IS NULL;
