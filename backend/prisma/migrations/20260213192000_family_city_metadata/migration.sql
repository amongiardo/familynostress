-- AlterTable
ALTER TABLE "families"
  ADD COLUMN IF NOT EXISTS "city_display_name" TEXT,
  ADD COLUMN IF NOT EXISTS "city_country" TEXT,
  ADD COLUMN IF NOT EXISTS "city_timezone" TEXT,
  ADD COLUMN IF NOT EXISTS "city_latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "city_longitude" DOUBLE PRECISION;
