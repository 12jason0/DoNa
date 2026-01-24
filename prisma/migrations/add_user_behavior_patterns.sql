-- CreateTable
CREATE TABLE "user_behavior_patterns" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "concept_pattern" JSONB NOT NULL,
    "region_pattern" JSONB NOT NULL,
    "mood_pattern" JSONB NOT NULL,
    "goal_pattern" JSONB NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_behavior_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_behavior_patterns_user_id_snapshot_date_idx" ON "user_behavior_patterns"("user_id", "snapshot_date");

-- AddForeignKey
ALTER TABLE "user_behavior_patterns" ADD CONSTRAINT "user_behavior_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
