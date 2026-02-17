-- AlterTable
ALTER TABLE "families"
  ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_by_user_id" TEXT;

-- Backfill creator from oldest admin membership when available
WITH ranked_admin_members AS (
  SELECT
    fm."family_id",
    fm."user_id",
    ROW_NUMBER() OVER (PARTITION BY fm."family_id" ORDER BY fm."created_at" ASC) AS rn
  FROM "family_members" fm
  WHERE fm."role" = 'admin'
)
UPDATE "families" f
SET "created_by_user_id" = ram."user_id"
FROM ranked_admin_members ram
WHERE f."id" = ram."family_id"
  AND ram.rn = 1
  AND f."created_by_user_id" IS NULL;

-- Fallback creator from oldest membership if no admin found
WITH ranked_members AS (
  SELECT
    fm."family_id",
    fm."user_id",
    ROW_NUMBER() OVER (PARTITION BY fm."family_id" ORDER BY fm."created_at" ASC) AS rn
  FROM "family_members" fm
)
UPDATE "families" f
SET "created_by_user_id" = rm."user_id"
FROM ranked_members rm
WHERE f."id" = rm."family_id"
  AND rm.rn = 1
  AND f."created_by_user_id" IS NULL;

CREATE INDEX IF NOT EXISTS "families_deleted_at_idx" ON "families"("deleted_at");
CREATE INDEX IF NOT EXISTS "families_created_by_user_id_idx" ON "families"("created_by_user_id");
CREATE INDEX IF NOT EXISTS "families_deleted_by_user_id_idx" ON "families"("deleted_by_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'families_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE "families"
      ADD CONSTRAINT "families_created_by_user_id_fkey"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'families_deleted_by_user_id_fkey'
  ) THEN
    ALTER TABLE "families"
      ADD CONSTRAINT "families_deleted_by_user_id_fkey"
      FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
