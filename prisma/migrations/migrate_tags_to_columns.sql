-- Step 1: 새 컬럼 추가
ALTER TABLE "courses" 
ADD COLUMN "mood" TEXT[] DEFAULT '{}',
ADD COLUMN "goal" VARCHAR(50),
ADD COLUMN "scene" VARCHAR(100),
ADD COLUMN "target_audience" VARCHAR(100),
ADD COLUMN "budget_level" VARCHAR(20),
ADD COLUMN "budget_range" VARCHAR(50),
ADD COLUMN "budget_min" INTEGER,
ADD COLUMN "budget_max" INTEGER,
ADD COLUMN "route_difficulty" VARCHAR(20),
ADD COLUMN "target_description" VARCHAR(500),
ADD COLUMN "perfect_for" TEXT[] DEFAULT '{}';

-- Step 2: 기존 JSON 데이터를 새 컬럼으로 이동
-- mood: tags.mood를 배열로 변환
UPDATE "courses" 
SET "mood" = CASE 
  WHEN tags->>'mood' IS NOT NULL THEN ARRAY[tags->>'mood']::TEXT[]
  ELSE '{}'::TEXT[]
END
WHERE tags IS NOT NULL;

-- goal: tags.goal을 컬럼으로
UPDATE "courses"
SET "goal" = tags->>'goal'
WHERE tags->>'goal' IS NOT NULL;

-- Step 3: 인덱스 생성 (성능 최적화)
CREATE INDEX "courses_scene_idx" ON "courses"("scene");
CREATE INDEX "courses_budget_level_idx" ON "courses"("budget_level");
CREATE INDEX "courses_route_difficulty_idx" ON "courses"("route_difficulty");
CREATE INDEX "courses_mood_idx" ON "courses" USING GIN ("mood");
CREATE INDEX "courses_scene_budget_difficulty_idx" ON "courses"("scene", "budget_level", "route_difficulty");

-- Step 4: tags JSON 정리 (선택적 - 나중에 실행)
-- UPDATE "courses" SET tags = NULL WHERE tags IS NOT NULL;
-- 또는 필요한 데이터만 남기고 싶다면:
-- UPDATE "courses" SET tags = tags - 'mood' - 'goal' WHERE tags IS NOT NULL;
