-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FamilyRole') THEN
    CREATE TYPE "FamilyRole" AS ENUM ('admin', 'member');
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "family_members" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "FamilyRole" NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- Bootstrap memberships from legacy users.family_id/users.role
INSERT INTO "family_members" ("id", "family_id", "user_id", "role", "created_at")
SELECT
  md5(random()::text || clock_timestamp()::text || u."id"),
  u."family_id",
  u."id",
  CASE
    WHEN u."role"::text = 'admin' THEN 'admin'::"FamilyRole"
    ELSE 'member'::"FamilyRole"
  END,
  CURRENT_TIMESTAMP
FROM "users" u
LEFT JOIN "family_members" fm
  ON fm."family_id" = u."family_id" AND fm."user_id" = u."id"
WHERE u."family_id" IS NOT NULL
  AND fm."id" IS NULL;

-- Indexes / unique constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'family_members_family_id_user_id_key'
  ) THEN
    ALTER TABLE "family_members"
      ADD CONSTRAINT "family_members_family_id_user_id_key" UNIQUE ("family_id", "user_id");
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "family_members_user_id_idx" ON "family_members"("user_id");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'family_members_family_id_fkey'
  ) THEN
    ALTER TABLE "family_members"
      ADD CONSTRAINT "family_members_family_id_fkey"
      FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'family_members_user_id_fkey'
  ) THEN
    ALTER TABLE "family_members"
      ADD CONSTRAINT "family_members_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Drop legacy FK users -> families
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_family_id_fkey'
  ) THEN
    ALTER TABLE "users" DROP CONSTRAINT "users_family_id_fkey";
  END IF;
END
$$;

-- Drop legacy columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "family_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";

-- Drop old enum if present and unused
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    DROP TYPE "UserRole";
  END IF;
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    NULL;
END
$$;
