-- Add tips column to course_places (unified tip field).
-- When tips is null, app merges coaching_tip_free + coaching_tip via getMergedTipsFromRow.
ALTER TABLE "course_places" ADD COLUMN "tips" TEXT;
