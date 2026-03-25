ALTER TABLE "families"
  ADD COLUMN "rotation_window_days" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "max_weekly_dish_repeat" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "event_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "event_mode_title" TEXT,
  ADD COLUMN "event_mode_start" DATE,
  ADD COLUMN "event_mode_end" DATE;

ALTER TABLE "family_members"
  ADD COLUMN "can_manage_planning" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "can_manage_shopping" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "can_moderate_chat" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "is_read_only" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "dishes"
  ADD COLUMN "estimated_cost" DOUBLE PRECISION;

CREATE TABLE "pantry_items" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "created_by_user_id" TEXT,
  "name" TEXT NOT NULL,
  "quantity" TEXT,
  "unit" TEXT,
  "expires_at" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pantry_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "weekly_templates" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "created_by_user_id" TEXT,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "weekly_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "weekly_template_items" (
  "id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "day_offset" INTEGER NOT NULL,
  "meal_type" "MealType" NOT NULL,
  "slot_category" "DishCategory" NOT NULL,
  "dish_id" TEXT NOT NULL,

  CONSTRAINT "weekly_template_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "user_id" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "details" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pantry_items_family_id_expires_at_idx" ON "pantry_items"("family_id", "expires_at");
CREATE INDEX "weekly_templates_family_id_created_at_idx" ON "weekly_templates"("family_id", "created_at");
CREATE INDEX "weekly_template_items_dish_id_idx" ON "weekly_template_items"("dish_id");
CREATE INDEX "audit_logs_family_id_created_at_idx" ON "audit_logs"("family_id", "created_at");

CREATE UNIQUE INDEX "weekly_template_items_template_id_day_offset_meal_type_slot_category_key"
  ON "weekly_template_items"("template_id", "day_offset", "meal_type", "slot_category");

ALTER TABLE "pantry_items"
  ADD CONSTRAINT "pantry_items_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pantry_items"
  ADD CONSTRAINT "pantry_items_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "weekly_templates"
  ADD CONSTRAINT "weekly_templates_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_templates"
  ADD CONSTRAINT "weekly_templates_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "weekly_template_items"
  ADD CONSTRAINT "weekly_template_items_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "weekly_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_template_items"
  ADD CONSTRAINT "weekly_template_items_dish_id_fkey"
  FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
