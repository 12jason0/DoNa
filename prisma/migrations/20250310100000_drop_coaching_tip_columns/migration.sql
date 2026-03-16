-- Backfill: merge coaching_tip_free + coaching_tip into tips where tips is null
UPDATE course_places
SET tips = (
  (
    COALESCE(
      (SELECT jsonb_agg(elem) FROM jsonb_array_elements(COALESCE(coaching_tip_free::jsonb, '[]'::jsonb)) AS elem),
      '[]'::jsonb
    ) ||
    COALESCE(
      (SELECT jsonb_agg(elem) FROM jsonb_array_elements(COALESCE(coaching_tip::jsonb, '[]'::jsonb)) AS elem),
      '[]'::jsonb
    )
  )::text
)
WHERE tips IS NULL
  AND (coaching_tip_free IS NOT NULL AND coaching_tip_free <> '' OR coaching_tip IS NOT NULL AND coaching_tip <> '');

-- Drop deprecated columns
ALTER TABLE "course_places" DROP COLUMN IF EXISTS "coaching_tip";
ALTER TABLE "course_places" DROP COLUMN IF EXISTS "coaching_tip_en";
ALTER TABLE "course_places" DROP COLUMN IF EXISTS "coaching_tip_ja";
ALTER TABLE "course_places" DROP COLUMN IF EXISTS "coaching_tip_zh";
ALTER TABLE "course_places" DROP COLUMN IF EXISTS "coaching_tip_free";
ALTER TABLE "course_places" DROP COLUMN IF EXISTS "coaching_tip_free_en";
ALTER TABLE "course_places" DROP COLUMN IF EXISTS "coaching_tip_free_ja";
ALTER TABLE "course_places" DROP COLUMN IF EXISTS "coaching_tip_free_zh";
