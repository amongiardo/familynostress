-- CreateTable
CREATE TABLE "meal_outs" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal_type" "MealType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_outs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meal_outs_family_id_date_meal_type_key" ON "meal_outs"("family_id", "date", "meal_type");

-- AddForeignKey
ALTER TABLE "meal_outs" ADD CONSTRAINT "meal_outs_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
