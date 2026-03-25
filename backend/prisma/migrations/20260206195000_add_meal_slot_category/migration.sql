-- Add slot_category to meal_plans and backfill from dish category
ALTER TABLE "meal_plans" ADD COLUMN "slot_category" "DishCategory";

UPDATE "meal_plans" mp
SET "slot_category" = d."category"
FROM "dishes" d
WHERE mp."dish_id" = d."id";

-- Remove duplicates per slot (keep most recent)
DELETE FROM "meal_plans"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "family_id", "date", "meal_type", "slot_category"
        ORDER BY "created_at" DESC
      ) AS rn
    FROM "meal_plans"
  ) t
  WHERE t.rn > 1
);

ALTER TABLE "meal_plans" ALTER COLUMN "slot_category" SET NOT NULL;

DROP INDEX IF EXISTS "meal_plans_family_id_date_meal_type_dish_id_key";

CREATE UNIQUE INDEX "meal_plans_family_id_date_meal_type_slot_category_key"
ON "meal_plans"("family_id", "date", "meal_type", "slot_category");
