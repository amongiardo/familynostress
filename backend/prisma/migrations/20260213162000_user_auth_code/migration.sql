-- AlterTable
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "auth_code" VARCHAR(5);

-- Backfill auth code for existing users
UPDATE "users"
SET "auth_code" = UPPER(SUBSTRING(md5(random()::text || clock_timestamp()::text), 1, 5))
WHERE "auth_code" IS NULL;
