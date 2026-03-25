-- Add city column to families with default
ALTER TABLE "families" ADD COLUMN "city" TEXT NOT NULL DEFAULT 'Roma';
