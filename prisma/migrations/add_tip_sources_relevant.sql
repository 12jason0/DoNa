-- 팁 근거 자료: 가게 이름이 없어 걸러진 글 표시 (2026-10)
-- 기존 행은 모두 true(관련 있음)로 채워짐. 여러 번 실행해도 안전.
ALTER TABLE tip_sources ADD COLUMN IF NOT EXISTS relevant boolean NOT NULL DEFAULT true;
